#!/bin/sh
# Serves this folder on the LAN so a phone on the same Wi-Fi can open the game (CON-19).
# Usage: ./dev.sh [port]   (default port 8000). POSIX sh, Linux and macOS.
set -eu
cd -- "$(dirname -- "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "dev.sh: python3 not found, install Python 3 first" >&2
  exit 1
fi

PORT="${1:-8000}"
case "$PORT" in
  ''|*[!0-9]*) echo "dev.sh: invalid port: $PORT" >&2; exit 1 ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "dev.sh: port out of range: $PORT" >&2
  exit 1
fi

# Fails only while a socket is actually listening on the port, on the wildcard or on loopback.
# SO_REUSEADDR ignores TIME_WAIT left by a previous server, so a quick restart is not blocked.
if ! python3 -c '
import socket, sys
port = int(sys.argv[1])
for host in ("0.0.0.0", "127.0.0.1"):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind((host, port))
    except OSError:
        sys.exit(1)
    finally:
        s.close()
' "$PORT"; then
  echo "dev.sh: port already in use: $PORT (try: ./dev.sh <other port>)" >&2
  exit 1
fi

# Candidate "interface address" pairs, Darwin first (en0, en1), then every other interface.
lan_candidates() {
  if [ "$(uname -s)" = "Darwin" ]; then
    for IF in en0 en1; do
      A=$(ipconfig getifaddr "$IF" 2>/dev/null || true)
      [ -n "$A" ] && echo "$IF $A"
    done
  fi
  if command -v ip >/dev/null 2>&1; then
    ip -4 -o addr show 2>/dev/null | awk '{ split($4, a, "/"); print $2, a[1] }'
  fi
  ifconfig 2>/dev/null | awk '/^[^ \t]/ { name = $1; sub(/:$/, "", name) } $1 == "inet" { print name, $2 }'
}

# Drops virtual/tunnel interfaces, loopback, link-local, Docker's 172.17.* and Tailscale/CGNAT 100.64.0.0/10.
# Output: "iface ip" lines, first line = address to show on the phone URL.
CANDIDATES=$(lan_candidates | awk '
  !seen[$0]++ &&
  $1 !~ /^(utun|tun|wg|docker|bridge|br-|veth|lo|gif|stf|awdl|llw)/ &&
  $2 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ &&
  $2 !~ /^(127\.|169\.254\.|0\.0\.0\.0$|172\.17\.)/ &&
  $2 !~ /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./ { print }
' || true)
IP=$(printf '%s\n' "$CANDIDATES" | awk 'NF { print $2; exit }')
OTHERS=$(printf '%s\n' "$CANDIDATES" | awk 'NR > 1 && NF { printf "%s%s (%s)", (n++ ? ", " : ""), $2, $1 }')

echo "Crowd Blast dev server (port $PORT)"
if [ -n "$IP" ]; then
  echo "  Phone (same Wi-Fi):  http://$IP:$PORT/?debug"
  if [ -n "$OTHERS" ]; then
    echo "  Other addresses:     $OTHERS (not used)"
  fi
else
  echo "  Phone (same Wi-Fi):  no LAN address found, replace <ip> with your computer's IP"
  IP="<ip>"
fi
echo "  Local:               http://localhost:$PORT/"
echo "  Engine dev page:     http://$IP:$PORT/src/engine/dev.html"
echo "Press Ctrl+C to stop."

exec python3 -m http.server "$PORT" --bind 0.0.0.0
