#!/usr/bin/env bash
# ==============================================================================
# LifeKeeper · Actualizar la web en el servidor (Ubuntu + Docker Compose)
#
#   cd ~/lifekeeper
#   ./scripts/update-web.sh                 # actualiza la rama por defecto
#   ./scripts/update-web.sh main            # otra rama
#   ./scripts/update-web.sh --no-cache      # reconstruye las imágenes desde cero
#   ./scripts/update-web.sh --no-backup     # sin copia de la base de datos
#   ./scripts/update-web.sh --dry-run       # solo muestra qué haría
#
# Qué hace, en orden:
#   1) Copia de seguridad de la base de datos (se guardan las últimas 10).
#   2) Trae la última versión del código (git pull sin pisar nada).
#   3) Se asegura de que exista el .env y de que JWT_SECRET tenga una clave propia.
#   4) Reconstruye las imágenes api, web y tts y reinicia los servicios.
#   5) Espera a que el servidor responda y verifica las APIs públicas.
# ==============================================================================
set -Eeuo pipefail

BRANCH="claude/affectionate-brown-hsgmfd"
NO_CACHE=""
BACKUP=1
DRY=0
for arg in "$@"; do
  case "$arg" in
    --no-cache)  NO_CACHE="--no-cache" ;;
    --no-backup) BACKUP=0 ;;
    --dry-run)   DRY=1 ;;
    -h|--help)   sed -n '2,19p' "$0"; exit 0 ;;
    -*)          echo "Opción desconocida: $arg (usá --help)"; exit 2 ;;
    *)           BRANCH="$arg" ;;
  esac
done

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
BACKUP_DIR="${LK_BACKUP_DIR:-$HOME/lifekeeper-backups}"
PG_USER="${POSTGRES_USER:-lifekeeper_admin}"
PG_DB="${POSTGRES_DB:-lifekeeper_vault}"

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_dim=$'\e[2m'; c_off=$'\e[0m'
step() { echo; echo "${c_ok}▶ $*${c_off}"; }
info() { echo "  $*"; }
warn() { echo "${c_warn}  ⚠ $*${c_off}"; }
die()  { echo "${c_err}✖ $*${c_off}" >&2; exit 1; }

# Ejecuta (o, con --dry-run, solo muestra) un comando
run() {
  if [ "$DRY" = 1 ]; then echo "${c_dim}  [dry-run] $*${c_off}"; else "$@"; fi
}

trap 'die "Falló en la línea $LINENO. Revisá el mensaje de arriba (el servicio anterior sigue corriendo si no llegó al paso de reinicio)."' ERR

[ "$DRY" = 1 ] && warn "Modo prueba: no se cambia nada."
echo "Carpeta: $ROOT · Rama: $BRANCH"

# --- 0) Requisitos -----------------------------------------------------------
step "Revisando requisitos"
command -v git >/dev/null    || die "Falta git."
command -v docker >/dev/null || die "Falta docker."
docker compose version >/dev/null 2>&1 || die "Falta el plugin 'docker compose'."
[ -f docker-compose.yml ] || die "No encuentro docker-compose.yml: corré el script desde la carpeta del proyecto."
info "git, docker y docker compose: OK"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short
  die "Hay cambios locales sin guardar en el servidor. Guardalos (git stash) o descartalos antes de actualizar."
fi

# --- 1) Copia de seguridad ---------------------------------------------------
if [ "$BACKUP" = 1 ]; then
  step "Copia de seguridad de la base de datos"
  if docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
    run mkdir -p "$BACKUP_DIR"
    FILE="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz"
    if [ "$DRY" = 1 ]; then
      info "[dry-run] pg_dump → $FILE"
    else
      docker compose exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" | gzip > "$FILE"
      [ -s "$FILE" ] || die "La copia quedó vacía: $FILE"
      info "Guardada en $FILE ($(du -h "$FILE" | cut -f1))"
      # Se conservan solo las 10 más recientes
      ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f --
    fi
  else
    warn "Postgres no está corriendo: se omite la copia (normal en la primera instalación)."
  fi
fi

# --- 2) Código ---------------------------------------------------------------
step "Trayendo la última versión de '$BRANCH'"
run git fetch origin "$BRANCH"
run git checkout "$BRANCH"
run git pull --ff-only origin "$BRANCH"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
info "Versión: $COMMIT — $(git log -1 --pretty=%s 2>/dev/null | cut -c1-90)"

# --- 3) .env y clave JWT -----------------------------------------------------
step "Configuración (.env)"
if [ ! -f .env ]; then
  [ -f .env.example ] || die "No hay .env ni .env.example."
  run cp .env.example .env
  info "Creé .env a partir de .env.example"
fi
if ! grep -Eq '^JWT_SECRET=.{32,}' .env 2>/dev/null; then
  warn "JWT_SECRET no está definido (o es muy corto): genero una clave propia."
  if [ "$DRY" = 1 ]; then
    info "[dry-run] node scripts/gen-secrets.mjs (o openssl rand -hex 48)"
  elif command -v node >/dev/null; then
    node scripts/gen-secrets.mjs
  else
    sed -i '/^JWT_SECRET=/d' .env
    printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 48)" >> .env
    chmod 600 .env
  fi
  warn "Las sesiones en la nube abiertas se cierran una vez (la app vuelve a iniciar sola con tu contraseña)."
else
  info "JWT_SECRET: OK"
fi

# --- 4) Construir y reiniciar ------------------------------------------------
step "Construyendo imágenes (api, web, tts)${NO_CACHE:+ sin caché}"
# shellcheck disable=SC2086
run docker compose build $NO_CACHE api web tts
step "Reiniciando servicios"
run docker compose up -d

# --- 5) Verificación ---------------------------------------------------------
step "Esperando a que el servidor responda"
if [ "$DRY" = 1 ]; then
  info "[dry-run] curl http://localhost/api/public/status"
else
  OK=0
  for i in $(seq 1 30); do
    if curl -fsS -m 3 http://localhost/api/public/status 2>/dev/null | grep -q '"ok":true'; then OK=1; break; fi
    printf '.'; sleep 2
  done
  echo
  [ "$OK" = 1 ] && info "El servidor responde ✔" || { docker compose logs --tail=40 api; die "El servidor no respondió en 60 s. Mirá los logs de arriba."; }

  if command -v node >/dev/null; then
    step "Verificando APIs públicas (feriados, inflación, ejercicios, ciudades, MedlinePlus)"
    node scripts/verify-public-apis.mjs http://localhost || warn "Alguna API externa no respondió (no impide usar la app). Pegame la salida si querés que la revise."
  fi
  docker image prune -f >/dev/null 2>&1 || true
fi

step "Estado"
run docker compose ps
echo
echo "${c_ok}✔ Listo. Versión $COMMIT publicada.${c_off}"
echo "  Probala en https://app.lifekeeper.lat (recargá con Ctrl+F5 para tomar los archivos nuevos)."
