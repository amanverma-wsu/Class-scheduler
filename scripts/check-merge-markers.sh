#!/usr/bin/env bash
set -euo pipefail

files=(README.md app.js index.html style.css)
if rg -n "<<<<<<<|=======|>>>>>>>" "${files[@]}"; then
  echo "❌ Merge conflict markers found."
  exit 1
fi

echo "✅ No merge conflict markers found in tracked app files."
