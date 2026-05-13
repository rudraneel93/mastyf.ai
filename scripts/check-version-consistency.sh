#!/usr/bin/env bash
set -euo pipefail

PKG_VERSION=$(node -p "require('./package.json').version")
README_VERSIONS=$(grep -oP 'v?\d+\.\d+\.\d+' README.md | sort -u)

echo "Package version: $PKG_VERSION"
echo "README versions found:"
echo "$README_VERSIONS"

# Check that README references the current version
if ! grep -q "$PKG_VERSION" README.md; then
  echo "ERROR: README does not reference package version $PKG_VERSION"
  exit 1
fi

# Check glama.json matches
GLAMA_VERSION=$(node -p "require('./glama.json').version")
if [ "$GLAMA_VERSION" != "$PKG_VERSION" ]; then
  echo "ERROR: glama.json version ($GLAMA_VERSION) != package.json version ($PKG_VERSION)"
  exit 1
fi

echo "Version consistency check passed."