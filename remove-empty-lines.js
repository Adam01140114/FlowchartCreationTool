#!/usr/bin/env node

/**
 * Remove completely empty lines from a file (lines that are only whitespace).
 *
 * Usage:
 *   node remove-empty-lines.js <file-path>
 *
 * Notes:
 * - The script preserves single newlines between non-empty lines; only lines
 *   that become empty after trimming whitespace are removed.
 * - The file is overwritten in-place.
 */

const fs = require('fs');

if (process.argv.length < 3) {
  console.error('Usage: node remove-empty-lines.js <file-path>');
  process.exit(1);
}

const filePath = process.argv[2];

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

const original = fs.readFileSync(filePath, 'utf8');
const originalLines = original.split('\n');
const filteredLines = originalLines.filter(line => line.trim() !== '');

fs.writeFileSync(filePath, filteredLines.join('\n'), 'utf8');

console.log(`✅ Removed ${originalLines.length - filteredLines.length} empty lines from ${filePath}`);

