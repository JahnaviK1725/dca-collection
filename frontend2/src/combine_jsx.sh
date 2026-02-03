#!/bin/bash

OUTPUT_FILE="combined_output.jsx"

# Clear the output file if it exists
> "$OUTPUT_FILE"

echo "Scanning for .jsx files recursively..."

# Find all .jsx files recursively
# 1. -type f: Only look for files (not directories)
# 2. -name "*.jsx": Match files ending in .jsx
# 3. -not -path "*/node_modules/*": IGNORE node_modules folder (Important!)
# 4. -not -name "$OUTPUT_FILE": Don't try to read the file we are writing to
find . -type f -name "*.jsx" -not -path "*/node_modules/*" -not -name "$OUTPUT_FILE" | while read -r file; do
  
  echo "Processing: $file"

  echo "// ==========================================" >> "$OUTPUT_FILE"
  echo "// START OF FILE: $file" >> "$OUTPUT_FILE"
  echo "// ==========================================" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  
  cat "$file" >> "$OUTPUT_FILE"
  
  echo "" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

echo "Done! All .jsx files have been merged into $OUTPUT_FILE"