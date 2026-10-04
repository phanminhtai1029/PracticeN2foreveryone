#!/usr/bin/env bash
# Usage: npm run audio:upload -- <file.mp3> <r2-key> [--remote]
# Strips embedded cover art (it breaks some browsers) and uploads to R2.
set -euo pipefail
src="$1"; key="$2"; mode="${3:---local}"
tmp="$(mktemp --suffix=.mp3)"
trap 'rm -f "$tmp"' EXIT
ffmpeg -loglevel error -y -i "$src" -map 0:a -c copy "$tmp"
npx wrangler r2 object put "n2-audio/$key" --file "$tmp" --content-type audio/mpeg "$mode"
