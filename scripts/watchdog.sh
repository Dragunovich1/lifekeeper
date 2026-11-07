#!/usr/bin/env bash
# ==============================================================================
# LifeKeeper · Vigilante del servidor (lo ejecuta systemd cada minuto; ver install-autostart.sh)
#
# Si la web/API no responde dos veces seguidas (para no actuar en medio de una actualización):
#   1) levanta lo que esté caído      -> docker compose up -d
#   2) reinicia lo que esté "unhealthy" (vivo pero trabado)
#   3) si todo parece bien pero igual no responde, reinicia api y web
# Cada acción queda en el registro:  journalctl -u lifekeeper-watchdog -n 50
# ==============================================================================
set -u
cd "$(dirname "$0")/.."

URL="${LK_HEALTH_URL:-http://localhost/api/public/status}"
STATE="/run/lifekeeper-watchdog.fails"
COOLDOWN_FILE="/run/lifekeeper-watchdog.last"
COOLDOWN=180   # segundos mínimos entre dos intervenciones
log() { echo "[watchdog] $*"; }

# ¿Hay una actualización corriendo? (update-web.sh reconstruye imágenes: no molestar)
if pgrep -f "scripts/update-web.sh" >/dev/null 2>&1 || pgrep -f "docker compose (build|up)" >/dev/null 2>&1; then
  exit 0
fi

if curl -fsS -m 8 "$URL" 2>/dev/null | grep -q '"ok":true'; then
  rm -f "$STATE"
  exit 0
fi

fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE"
log "sin respuesta de $URL (intento $fails)"
[ "$fails" -lt 2 ] && exit 0

now=$(date +%s)
last=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo 0)
if [ $(( now - last )) -lt "$COOLDOWN" ]; then
  log "esperando: la última intervención fue hace menos de ${COOLDOWN}s"
  exit 0
fi
echo "$now" > "$COOLDOWN_FILE"

if ! docker info >/dev/null 2>&1; then
  log "Docker no responde: lo inicio"
  systemctl start docker || true
  sleep 8
fi

# 1) Contenedores caídos o detenidos
down=$(docker compose ps --all --format '{{.Name}} {{.State}}' 2>/dev/null | awk '$2 != "running" {print $1}')
if [ -n "$down" ]; then
  log "contenedores detenidos: $(echo $down | tr '\n' ' ') → docker compose up -d"
  docker compose up -d
fi

# 2) Contenedores vivos pero trabados
for c in $(docker ps --filter "name=lifekeeper-" --format '{{.Names}}'); do
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null)
  if [ "$health" = "unhealthy" ]; then
    log "$c está unhealthy → docker restart"
    docker restart "$c" >/dev/null
  fi
done

# 3) Sigue sin responder aunque todo figura "running": reinicio api y web
sleep 15
if ! curl -fsS -m 8 "$URL" 2>/dev/null | grep -q '"ok":true'; then
  log "sigue sin responder → reinicio api y web"
  docker compose restart api web >/dev/null 2>&1 || true
else
  log "recuperado"
  rm -f "$STATE"
fi
