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
	# The clipboard only works over HTTPS, so the phone needs `tailscale serve --bg <port>` in front of
	# this server to copy readout values. Once that's set up, print its HTTPS address too.
	serve_status="$(tailscale serve status 2>/dev/null || true)"
	if [[ "$serve_status" == *"127.0.0.1:${port}"* ]]; then
		https_url="$(grep -o '^https://[^ ]*' <<<"$serve_status" | head -n1)"
		echo "HTTPS:     ${https_url}/?debug"
	fi
fi
echo

# Python's own http.server sends no caching headers, so browsers guess, and a phone can keep running an
# old module for hours after an edit. This one tells them not to keep copies at all.
exec python3 - "$port" "$dir" <<'PYTHON'
import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1])
handler = functools.partial(NoCacheHandler, directory=sys.argv[2])
print(f"Serving on port {port}, with caching off.", flush=True)
http.server.ThreadingHTTPServer(("0.0.0.0", port), handler).serve_forever()
PYTHON
