#!/bin/sh
# Jalankan sekali dengan sudo di VPS: pasang nginx host + sertifikat untuk pos.danuseta.my.id.
# Cloudflare memaksa HTTPS, jadi challenge ACME masuk lewat port 443. Sebelum sertifikat
# pos ada, blok 443 sementara memakai sertifikat danuseta.my.id yang sudah ada.
set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
SITE=/etc/nginx/sites-available/pos-soswir
LIVE=/etc/letsencrypt/live/pos.danuseta.my.id

if [ ! -f "$LIVE/fullchain.pem" ]; then
  sed 's#/live/pos.danuseta.my.id/#/live/danuseta.my.id/#' "$DIR/host-nginx.conf" > "$SITE"
  ln -sf "$SITE" /etc/nginx/sites-enabled/pos-soswir
  nginx -t
  systemctl reload nginx
  certbot certonly --webroot -w /var/www/html -d pos.danuseta.my.id \
    --non-interactive --agree-tos --keep-until-expiring \
    --deploy-hook "systemctl reload nginx"
fi

cp "$DIR/host-nginx.conf" "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/pos-soswir
nginx -t
systemctl reload nginx
echo "pos.danuseta.my.id siap"
