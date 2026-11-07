#!/bin/sh
# Builds Hacker and publishes it to GitHub Pages (the gh-pages branch).
# Run with: npm run deploy
set -e
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
  echo "Save (commit) your changes first, so the published site matches a saved version."
  exit 1
fi
npm test
npm run build
REMOTE=$(git remote get-url origin)
EMAIL=$(git config user.email)
VERSION=$(git rev-parse --short HEAD)
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$EMAIL" commit -q -m "Publish $VERSION"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Published $VERSION. The site updates in about a minute: https://timblumentritt-ux.github.io/hacker/"
