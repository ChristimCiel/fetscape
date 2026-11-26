#!/bin/bash
# Fetscape v1 MVP - Cleanup Script
# Removes only Fetscape v1 artifacts, preserves existing project

set -e

echo "Fetscape v1 Cleanup Script"
echo "=========================="
echo ""
echo "This script will remove:"
echo "  - apps/web/src/fetscape/ directory"
echo "  - tests/fetscape-*.test.ts files"
echo "  - This cleanup script itself"
echo ""
echo "It will NOT remove:"
echo "  - Existing orbital-core, API, or web app"
echo "  - Existing tests and demos"
echo "  - Any git history"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Removing Fetscape v1 files..."

# Remove Fetscape app directory
if [ -d "apps/web/src/fetscape" ]; then
    rm -rf apps/web/src/fetscape
    echo "✓ Removed apps/web/src/fetscape/"
fi

# Remove Fetscape tests
rm -f tests/fetscape-*.test.ts
echo "✓ Removed tests/fetscape-*.test.ts"

# Note: The integration in App.tsx should be manually reverted if desired
echo ""
echo "⚠️  Note: Integration in apps/web/src/App.tsx should be manually reverted:"
echo "   1. Remove FetscapeApp import"
echo "   2. Remove 'fetscape' from Page type"
echo "   3. Remove 'fetscape' from NAV array"
echo "   4. Remove fetscape page rendering section"
echo ""

echo "Cleanup complete!"
echo ""
echo "To remove this script: rm scripts/cleanup-fetscape-v1.sh"
