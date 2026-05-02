#!/usr/bin/env node
/**
 * validate-substrate-coverage <dir>
 *
 * For each substrate type directory, checks bidirectional coverage:
 *   - Every .md file (excluding INDEX.md) has a row in INDEX.md
 *   - Every row in INDEX.md has a corresponding .md file
 *
 * INDEX.md row format: | ID | Description | Path | ...
 * The "Path" column value is matched against the filename.
 *
 * Exits 0 on success (including type dirs with only INDEX.md), non-zero on failure.
 */

import fs from 'fs';
import path from 'path';

const [,, dirPath] = process.argv;

if (!dirPath) {
  process.stderr.write('Usage: validate-substrate-coverage <path-to-.substrate/>\n');
  process.exit(1);
}

const absDir = path.resolve(dirPath);

if (!fs.existsSync(absDir)) {
  process.stderr.write(`Error: directory not found: ${absDir}\n`);
  process.exit(1);
}

const KNOWN_TYPES = ['vocabulary', 'adr', 'anti-pattern', 'solution', 'reviewers'];

let failed = false;
let typeCount = 0;

for (const typeDirName of KNOWN_TYPES) {
  const typeDir = path.join(absDir, typeDirName);
  if (!fs.existsSync(typeDir)) continue;
  typeCount++;

  const indexPath = path.join(typeDir, 'INDEX.md');

  // Collect entry files (all .md except INDEX.md)
  const allEntries = fs.readdirSync(typeDir)
    .filter(f => f.endsWith('.md') && f !== 'INDEX.md');

  // If no INDEX.md and no entry files, that's fine
  if (!fs.existsSync(indexPath)) {
    if (allEntries.length > 0) {
      for (const entry of allEntries) {
        process.stderr.write(
          `Error: ${typeDir}/${entry}: file exists but ${typeDirName}/INDEX.md is missing\n`
        );
        failed = true;
      }
    }
    continue;
  }

  // Parse INDEX.md to extract Path column values
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const indexRows = parseIndexPaths(indexContent, typeDir);

  // Bidirectional check
  // 1. Every entry file must have a matching row
  for (const entryFile of allEntries) {
    const entryBasename = entryFile;
    const normalized = `./${entryBasename}`;
    const found = indexRows.some(row => {
      const rowPath = row.replace(/^\.\//, '');
      const rowBase = path.basename(rowPath);
      return rowBase === entryBasename || rowPath === entryBasename || row === normalized;
    });
    if (!found) {
      process.stderr.write(
        `Error: ${typeDir}/${entryFile}: file exists but has no row in INDEX.md\n`
      );
      failed = true;
    }
  }

  // 2. Every INDEX.md row must have a corresponding file
  for (const rowPath of indexRows) {
    // rowPath is relative to the type dir, e.g. "./workspace.md"
    const normalized = rowPath.replace(/^\.\//, '');
    const fullPath = path.join(typeDir, normalized);
    if (!fs.existsSync(fullPath)) {
      process.stderr.write(
        `Error: INDEX.md in ${typeDir} references "${rowPath}" but file does not exist\n`
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);

process.stdout.write(
  `validate-substrate-coverage: OK (${typeCount} type director${typeCount === 1 ? 'y' : 'ies'} checked)\n`
);
process.exit(0);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse all "Path" column values from an INDEX.md markdown table.
 * Returns an array of path strings.
 */
function parseIndexPaths(content, typeDir) {
  const paths = [];
  const lines = content.split('\n');

  // Find the header row to locate the "Path" column index
  let pathColIndex = -1;
  let headerFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);

    if (!headerFound) {
      // Find header row
      const lowerCells = cells.map(c => c.toLowerCase());
      const pIdx = lowerCells.indexOf('path');
      if (pIdx !== -1) {
        pathColIndex = pIdx;
        headerFound = true;
      }
      continue;
    }

    // Skip separator row (--- cells)
    if (cells.every(c => c.match(/^[-:]+$/))) continue;

    // Data row
    if (pathColIndex >= 0 && cells.length > pathColIndex) {
      const cellVal = cells[pathColIndex].trim();
      if (cellVal) paths.push(cellVal);
    }
  }

  // Fallback: if no Path column found, try the last column (common convention)
  if (pathColIndex === -1) {
    let inTable = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) { inTable = false; continue; }
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (!inTable) {
        // Check for header
        if (cells.some(c => c.toLowerCase() === 'id')) {
          inTable = true;
        }
        continue;
      }
      if (cells.every(c => c.match(/^[-:]+$/))) continue;
      const last = cells[cells.length - 1];
      if (last && last.endsWith('.md')) paths.push(last);
    }
  }

  return paths;
}
