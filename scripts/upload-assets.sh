#!/usr/bin/env bash
# Usage: npm run assets:upload -- <exam-id> [--remote]
# Uploads content/exams/<id>/assets/* to R2 as exam-assets/<id>/<file>, served at /exam-assets/<id>/<file>.
set -euo pipefail
id="$1"; mode="${2:---local}"
for f in content/exams/"$id"/assets/*; do
  npx wrangler r2 object put "n2-audio/exam-assets/$id/$(basename "$f")" --file "$f" "$mode"
done
