#!/usr/bin/env node
/**
 * validate-slice-dag <path>
 *
 * Validates that semantic_depends_on in docs/plan.slices.yml is acyclic, and
 * that no file-overlap edges (entries without a `reason` field) have been
 * removed compared to what derive-file-dag last wrote.
 *
 * The "tamper" check works against a lock-file: .groove-file-dag-lock.json
 * written by derive-file-dag alongside plan.slices.yml. If the lock file
 * doesn't exist the tamper check is skipped with a warning.
 *
 * Exits 0 on success, non-zero on any failure.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const [,, filePath] = process.argv;

if (!filePath) {
  process.stderr.write('Usage: validate-slice-dag <path-to-plan.slices.yml>\n');
  process.exit(1);
}

const absPath = path.resolve(filePath);

if (!fs.existsSync(absPath)) {
  process.stderr.write(`Error: file not found: ${absPath}\n`);
  process.exit(1);
}

let doc;
try {
  const raw = fs.readFileSync(absPath, 'utf8');
  doc = yaml.load(raw);
} catch (err) {
  process.stderr.write(`Error: could not parse YAML: ${err.message}\n`);
  process.exit(1);
}

if (!doc || !Array.isArray(doc.slices)) {
  process.stderr.write('Error: invalid slices file — missing top-level "slices" array\n');
  process.exit(1);
}

const slices = doc.slices;
let failed = false;

// ── Cycle detection (DFS) ────────────────────────────────────────────────────

const adj = new Map(); // id → [dep-ids]
for (const slice of slices) {
  adj.set(slice.id, (slice.semantic_depends_on ?? []).map(d => d.id));
}

const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map();
for (const id of adj.keys()) color.set(id, WHITE);

function dfs(id, stack) {
  color.set(id, GRAY);
  stack.push(id);
  for (const dep of adj.get(id) ?? []) {
    if (color.get(dep) === GRAY) {
      const cycleStart = stack.indexOf(dep);
      const cycle = [...stack.slice(cycleStart), dep].join(' → ');
      process.stderr.write(`Error: cycle detected: ${cycle}\n`);
      failed = true;
      // continue so we can catch more cycles
    } else if (color.get(dep) === WHITE) {
      dfs(dep, stack);
    }
  }
  stack.pop();
  color.set(id, BLACK);
}

for (const id of adj.keys()) {
  if (color.get(id) === WHITE) dfs(id, []);
}

// ── Tamper check: file-overlap edges must not have been removed ──────────────

const lockPath = path.join(path.dirname(absPath), '.groove-file-dag-lock.json');

if (!fs.existsSync(lockPath)) {
  process.stderr.write('Warning: .groove-file-dag-lock.json not found — skipping file-overlap edge tamper check\n');
} else {
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`Warning: could not parse lock file: ${err.message} — skipping tamper check\n`);
    lock = null;
  }

  if (lock) {
    // lock: { [sliceId]: string[] }  — list of dependency slice ids that are file-overlap edges
    const currentEdges = new Map();
    for (const slice of slices) {
      const overlapIds = (slice.semantic_depends_on ?? [])
        .filter(d => !d.reason)
        .map(d => d.id);
      currentEdges.set(slice.id, new Set(overlapIds));
    }

    for (const [sliceId, lockedDepIds] of Object.entries(lock)) {
      const current = currentEdges.get(sliceId) ?? new Set();
      for (const depId of lockedDepIds) {
        if (!current.has(depId)) {
          process.stderr.write(
            `Error: file-overlap edge removed — slice "${sliceId}" no longer has file-overlap dependency "${depId}"\n`
          );
          failed = true;
        }
      }
    }
  }
}

if (failed) process.exit(1);

process.stdout.write(`validate-slice-dag: OK (${slices.length} slice${slices.length === 1 ? '' : 's'}, acyclic)\n`);
process.exit(0);
