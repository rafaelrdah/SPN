#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  printf 'Instale o Python 3 para iniciar o teste local.\n' >&2
  exit 1
fi

python3 - <<'PY'
import socket
import subprocess

with socket.socket() as probe:
    try:
        probe.bind(("0.0.0.0", 5000))
    except OSError as error:
        raise SystemExit(f"A porta 5000 não está disponível: {error}")

addresses = []
try:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        probe.connect(("192.0.2.1", 80))
        addresses.append(probe.getsockname()[0])
except OSError:
    pass
try:
    addresses += subprocess.check_output(["hostname", "-I"], text=True, stderr=subprocess.DEVNULL).split()
except (OSError, subprocess.CalledProcessError):
    pass
addresses = list(dict.fromkeys(ip for ip in addresses if "." in ip and not ip.startswith("127.")))
print("\nSupernatural · teste local iniciado na porta 5000", flush=True)
print("Neste computador: http://localhost:5000/", flush=True)
for ip in addresses:
    print(f"No celular (mesma rede Wi-Fi): http://{ip}:5000/", flush=True)
if not addresses:
    print("IP não identificado. No Linux, execute `hostname -I` para encontrá-lo.", flush=True)
print("Para parar: Ctrl+C.\n", flush=True)
PY

exec python3 -u -m http.server 5000 --bind 0.0.0.0 --directory "$SITE_DIR"
