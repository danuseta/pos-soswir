#!/bin/sh
# Satu-satunya perintah yang boleh dijalankan key CI (forced command di authorized_keys).
# Input: SHA commit 40 karakter hex lewat SSH_ORIGINAL_COMMAND.
set -eu

SHA="${SSH_ORIGINAL_COMMAND:-}"
case "$SHA" in
  *[!0-9a-f]* | "") echo "SHA tidak valid" >&2; exit 1 ;;
esac
[ "${#SHA}" -eq 40 ] || { echo "SHA tidak valid" >&2; exit 1; }

cd "$(dirname "$0")"

curl -fsSL "https://raw.githubusercontent.com/danuseta/pos-soswir/$SHA/deploy/compose.prod.yaml" -o compose.yaml.new
mv compose.yaml.new compose.yaml

export IMAGE_TAG="$SHA"
docker compose pull db api web migrate
docker compose up -d db
docker compose run --rm migrate
docker compose up -d --remove-orphans api web
docker image prune -f

for i in $(seq 1 20); do
  curl -fsS http://127.0.0.1:3202/health > /dev/null && { echo "deploy $SHA sehat"; exit 0; }
  sleep 3
done
echo "health check gagal setelah deploy $SHA" >&2
exit 1
