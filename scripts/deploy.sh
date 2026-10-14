#!/bin/sh
# Publish dist/ to the gh-pages branch (GitHub Pages serves it).
set -e
cd dist
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "Deployed to https://eli-riedel.github.io/pesopicks/"
