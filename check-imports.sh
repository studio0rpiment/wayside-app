#!/bin/bash

# Directory containing source files
SRC_DIR="/Users/kevinpatton/Documents/2a_DEVELOPER/__StudioOrpiment/wayside-app/src"

# Find all TypeScript/JavaScript files
FILES=$(find "$SRC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \))

# Check each file for imports in other files
for file in $FILES; do
  filename=$(basename "$file")
  name="${filename%.*}"
  
  # Skip type definition files and main entry points
  if [[ "$filename" == *.d.ts || "$filename" == "main.tsx" || "$filename" == "App.tsx" || "$filename" == "vite-env.d.ts" ]]; then
    echo "$filename: SKIPPED (system file)"
    continue
  fi
  
  # Search for imports of this file in all other files
  # Look for import patterns that would match this file
  result=$(grep -l -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    -E "from ['\"].*$name['\"]|import.*$name|require\(['\"].*$name['\"]" "$SRC_DIR" | \
    grep -v "$file")
  
  if [ -z "$result" ]; then
    echo "$filename: NOT IMPORTED"
  else
    imported_count=$(echo "$result" | wc -l)
    echo "$filename: Imported in $imported_count file(s)"
  fi
done