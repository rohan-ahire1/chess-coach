#!/usr/bin/env bash
# Deploy the pushed main to coachmate.rohanahire.com on the VPS (ssh host "vps").
# Each release is a fresh clone in ~/projects/coachmate-releases. ~/projects/coachmate
# is a symlink to the live one, which is where coachmate.service runs from, so a failed
# build or check leaves the live site alone.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin main
sha=$(git rev-parse HEAD)
if [ "$sha" != "$(git rev-parse origin/main)" ]; then
  echo "The VPS builds what is on GitHub. Push main first." >&2
  exit 1
fi

ssh vps bash -s -- "$sha" <<'REMOTE'
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH" NEXT_TELEMETRY_DISABLED=1
sha=$1
releases="$HOME/projects/coachmate-releases"
rel="$releases/$(date +%Y%m%d%H%M%S)-${sha:0:7}"

mkdir -p "$releases"
git clone -q --depth 1 git@github.com:rohan-ahire1/chess-coach.git "$rel"
cd "$rel"
[ "$(git rev-parse HEAD)" = "$sha" ]
npm ci --no-audit --no-fund
NEXT_PUBLIC_SITE_URL=https://coachmate.rohanahire.com npm run build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# Check the build on a spare port before it takes over.
port=$(for p in 8796 8797 8798 8799; do ss -tln | grep -q ":$p " || { echo "$p"; break; }; done)
(cd .next/standalone && NODE_ENV=production PORT=$port HOSTNAME=127.0.0.1 exec node server.js) &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -fs -o /dev/null "http://127.0.0.1:$port/" && break
  sleep 0.25
done
for path in / /report /drill /play /method /engine/stockfish-19-lite-single.js /pieces/wK.svg; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port$path")
  if [ "$code" != 200 ]; then
    echo "$path returned $code, so the live site stays as it is." >&2
    exit 1
  fi
done

ln -sfn "$rel" "$HOME/projects/coachmate"
sudo systemctl restart coachmate
for _ in $(seq 1 40); do
  curl -fs -o /dev/null http://127.0.0.1:8790/ && break
  sleep 0.25
done
curl -fs -o /dev/null http://127.0.0.1:8790/
ls -1dt "$releases"/* | tail -n +6 | xargs -r rm -rf
echo "Deployed $rel"
REMOTE
