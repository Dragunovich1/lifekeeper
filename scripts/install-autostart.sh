#!/usr/bin/env bash
# ==============================================================================
# LifeKeeper · Que el servidor se levante solo (se corre UNA vez, en el servidor)
#
#   cd ~/lifekeeper && sudo ./scripts/install-autostart.sh
#   sudo ./scripts/install-autostart.sh --status     # ver cómo está
#   sudo ./scripts/install-autostart.sh --remove     # deshacer todo
#
# Qué deja configurado:
#   1) Docker arranca con la máquina (systemctl enable docker).
#   2) lifekeeper.service: al encender el servidor se levantan todos los contenedores.
#   3) lifekeeper-watchdog.timer: cada minuto revisa la web y la API y, si no responden,
#      levanta lo caído, reinicia lo trabado y deja el registro en journalctl.
#   4) Sin suspensión: la máquina no se duerme ni al cerrar la tapa (es una notebook).
# ==============================================================================
set -Eeuo pipefail

[ "$(id -u)" = 0 ] || { echo "Corrélo con sudo:  sudo $0 $*"; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/docker-compose.yml" ] || { echo "No encuentro docker-compose.yml en $ROOT"; exit 1; }

ok()   { echo "  ✔ $*"; }
step() { echo; echo "▶ $*"; }

if [ "${1:-}" = "--status" ]; then
  step "Estado"
  systemctl is-enabled docker lifekeeper.service lifekeeper-watchdog.timer 2>&1 | paste - - - | sed 's/^/  docker | servicio | vigilante: /'
  systemctl list-timers lifekeeper-watchdog.timer --no-pager 2>/dev/null | head -3
  echo; journalctl -u lifekeeper-watchdog -n 10 --no-pager 2>/dev/null | sed 's/^/  /' || true
  echo; (cd "$ROOT" && docker compose ps)
  exit 0
fi

if [ "${1:-}" = "--remove" ]; then
  step "Quitando el arranque automático"
  systemctl disable --now lifekeeper-watchdog.timer lifekeeper.service 2>/dev/null || true
  rm -f /etc/systemd/system/lifekeeper.service /etc/systemd/system/lifekeeper-watchdog.service /etc/systemd/system/lifekeeper-watchdog.timer \
        /etc/systemd/logind.conf.d/lifekeeper-no-sleep.conf
  systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
  systemctl daemon-reload
  systemctl restart systemd-logind 2>/dev/null || true
  ok "listo (Docker y los contenedores quedan como estaban)"
  exit 0
fi

step "1/4 Docker arranca con la máquina"
systemctl enable --now docker >/dev/null 2>&1
ok "docker habilitado"

step "2/4 Los contenedores se levantan al encender"
chmod +x "$ROOT/scripts/watchdog.sh" "$ROOT/scripts/update-web.sh" 2>/dev/null || true
cat > /etc/systemd/system/lifekeeper.service <<EOF
[Unit]
Description=LifeKeeper (docker compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$ROOT
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose stop
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
ok "lifekeeper.service"

step "3/4 Vigilante: revisa cada minuto y repara solo"
cat > /etc/systemd/system/lifekeeper-watchdog.service <<EOF
[Unit]
Description=LifeKeeper: revisa que la web y la API respondan
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=$ROOT
ExecStart=$ROOT/scripts/watchdog.sh
EOF
cat > /etc/systemd/system/lifekeeper-watchdog.timer <<EOF
[Unit]
Description=LifeKeeper: vigilante (cada minuto)

[Timer]
OnBootSec=3min
OnUnitActiveSec=1min
AccuracySec=10s

[Install]
WantedBy=timers.target
EOF
ok "lifekeeper-watchdog.timer"

step "4/4 Sin suspensión (la notebook no se duerme, ni al cerrar la tapa)"
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/lifekeeper-no-sleep.conf <<EOF
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null 2>&1 || true
ok "suspensión desactivada"

systemctl daemon-reload
systemctl enable lifekeeper.service lifekeeper-watchdog.timer >/dev/null 2>&1
systemctl restart systemd-logind 2>/dev/null || true   # puede cortar sesiones gráficas, no la de SSH
systemctl start lifekeeper-watchdog.timer
ok "servicios activados"

echo
echo "Listo. Para comprobarlo:"
echo "  sudo ./scripts/install-autostart.sh --status"
echo "Probalo: 'docker stop lifekeeper-api' y en ~2-3 minutos vuelve solo."
