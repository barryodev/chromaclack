#!/usr/bin/env bash
# Serve the prototype on all interfaces so phones on the tailnet can reach it.
# Usage: ./serve.sh [port]
set -euo pipefail

port="${1:-8000}"
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Local:     http://localhost:${port}/?debug"
if command -v tailscale >/dev/null 2>&1; then
	if ip="$(tailscale ip -4 2>/dev/null | head -n1)" && [[ -n "$ip" ]]; then
		echo "Tailscale: http://${ip}:${port}/?debug"
	fi
	if name="$(tailscale status --self --json 2>/dev/null |
		python3 -c 'import json, sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null)" &&
		[[ -n "$name" ]]; then
		echo "           http://${name}:${port}/?debug"
	fi
fi
echo

exec python3 -m http.server "$port" --bind 0.0.0.0 --directory "$dir"
