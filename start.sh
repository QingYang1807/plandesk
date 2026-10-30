#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("PlanDesk needs Node.js 24+ (tested on 26.10)."); process.exit(1); }'
if [ ! -x node_modules/.bin/tsx ]; then
  npm ci --cache .npm-cache --no-audit --no-fund
fi
npm run build
exec npm start
