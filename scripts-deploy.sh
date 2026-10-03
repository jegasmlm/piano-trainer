#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (GitHub Pages).
set -euo pipefail
npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="jegasmlm" -c user.email="jegasmlm@users.noreply.github.com" commit -qm "Deploy $(date -Iseconds)"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -f "$(cd .. && git remote get-url origin)" gh-pages
rm -rf .git
