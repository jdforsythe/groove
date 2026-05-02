#!/usr/bin/env node
/**
 * derive-file-dag <path>
 *
 * Reads docs/plan.slices.yml, computes which pairs of slices share overlapping
 * touched_paths globs, and writes file-overlap dependency edges (entries with
 * id only, no reason field) into each affected slice's semantic_depends_on.
 *
 * Idempotent: re-running produces the same result as running once.
 * Preserves semantic edges (those with a reason field).
 * Does not add self-referential edges.
 *
 * Also writes a lock file (.groove-file-dag-lock.json) alongside plan.slices.yml
 * recording the set of file-overlap edges, so validate-slice-dag can detect tampering.
 *
 * Exits 0 on success, non-zero on failure.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import micromatch from 'micromatch';

const [,, filePath] = process.argv;

if (!filePath) {
  process.stderr.write('Usage: derive-file-dag <path-to-plan.slices.yml>\n');
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

// ── Compute file-overlap pairs ───────────────────────────────────────────────

/**
 * Two glob sets "overlap" if any concrete path that could match one also
 * matches the other. We approximate this by generating candidate paths from
 * each slice's globs and checking whether any candidate from slice A matches
 * any glob from slice B (and vice versa).
 *
 * Concrete strategy:
 *   1. Expand each glob into a set of candidate literal paths (for non-wildcard
 *      globs, the literal path itself; for wildcard globs, use the glob as a
 *      pattern and derive candidates from all other slices' literal paths).
 *   2. Check micromatch.isMatch(candidate, otherGlobs).
 *
 * Simpler approach that is correct for the common cases used in Groove plans:
 *   - Compare every glob in slice A against every glob in slice B using
 *     `micromatch.isMatch(glob_a, glob_b)` or `micromatch.isMatch(glob_b, glob_a)`.
 *   - Also check whether the globs share a common path prefix (the glob path
 *     itself, treated as a literal candidate, matches the other set).
 */
function globSetsOverlap(globsA, globsB) {
  // Strategy: for each glob in A, check if it matches any glob in B as a path,
  // and for each glob in B check if it matches any glob in A as a path.
  // This handles common cases like "src/auth/**" overlapping with "src/auth/service.ts".

  for (const ga of globsA) {
    if (micromatch.isMatch(ga, globsB)) return true;
    // Strip wildcards to get a candidate prefix path
    const candidate = stripWildcards(ga);
    if (candidate && micromatch.isMatch(candidate, globsB)) return true;
  }
  for (const gb of globsB) {
    if (micromatch.isMatch(gb, globsA)) return true;
    const candidate = stripWildcards(gb);
    if (candidate && micromatch.isMatch(candidate, globsA)) return true;
  }
  return false;
}

function stripWildcards(glob) {
  // Return the longest literal prefix before a wildcard character
  const idx = glob.search(/[*?[{]/);
  if (idx === -1) return glob;
  // e.g. "src/auth/**" → "src/auth/"
  let prefix = glob.slice(0, idx);
  // Remove trailing slash
  prefix = prefix.replace(/\/+$/, '');
  return prefix || null;
}

// ── Apply edges ──────────────────────────────────────────────────────────────

// Build a map of id → slice
const sliceMap = new Map(slices.map(s => [s.id, s]));

// For each slice, ensure semantic_depends_on is an array
for (const slice of slices) {
  if (!Array.isArray(slice.semantic_depends_on)) {
    slice.semantic_depends_on = [];
  }
}

// Lock: { [sliceId]: string[] } — ids of file-overlap deps
const lock = {};

// Only add edges from later slices to earlier slices (by declaration order)
// to avoid creating cycles. A slice at index i depends on slices at index j < i
// that share overlapping paths.
for (let i = 0; i < slices.length; i++) {
  const sliceA = slices[i];
  for (let j = 0; j < i; j++) {
    const sliceB = slices[j];

    const globsA = sliceA.touched_paths ?? [];
    const globsB = sliceB.touched_paths ?? [];

    if (globsA.length === 0 || globsB.length === 0) continue;

    if (globSetsOverlap(globsA, globsB)) {
      // sliceA (later) depends on sliceB (earlier, file-overlap edge)
      const existing = sliceA.semantic_depends_on.find(d => d.id === sliceB.id);
      if (!existing) {
        // Add file-overlap edge (no reason field)
        sliceA.semantic_depends_on.push({ id: sliceB.id });
      }
      // If existing edge already has reason, leave it alone (semantic edge takes precedence)
    }
  }

  // Record file-overlap edges in the lock
  const overlapEdges = sliceA.semantic_depends_on
    .filter(d => !d.reason)
    .map(d => d.id);
  if (overlapEdges.length > 0) {
    lock[sliceA.id] = overlapEdges;
  }
}

// ── Write updated YAML ───────────────────────────────────────────────────────

try {
  const updatedYaml = yaml.dump(doc, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(absPath, updatedYaml, 'utf8');
} catch (err) {
  process.stderr.write(`Error: could not write updated YAML: ${err.message}\n`);
  process.exit(1);
}

// ── Write lock file ──────────────────────────────────────────────────────────

const lockPath = path.join(path.dirname(absPath), '.groove-file-dag-lock.json');
try {
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
} catch (err) {
  process.stderr.write(`Warning: could not write lock file: ${err.message}\n`);
  // Non-fatal — the main operation succeeded
}

const edgeCount = Object.values(lock).reduce((sum, arr) => sum + arr.length, 0);
process.stdout.write(`derive-file-dag: OK (${edgeCount} file-overlap edge${edgeCount === 1 ? '' : 's'} written)\n`);
process.exit(0);
