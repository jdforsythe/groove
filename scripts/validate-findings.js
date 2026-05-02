#!/usr/bin/env node
/**
 * validate-findings <path>
 *
 * Validates docs/findings.json against the §2 findings schema.
 * Extra checks beyond JSON Schema:
 *   - All finding ids are unique
 *   - reviewer references a real entry in .substrate/reviewers/INDEX.md
 *   - in_scope is correctly computed:
 *       true  iff location.path matches a glob in any slice's touched_paths
 *       false iff location.path does NOT match any slice glob
 *     If docs/plan.slices.yml is absent, the in_scope check is skipped (warns).
 *     If a finding has no location.path, in_scope check for that finding is skipped.
 *
 * Exits 0 on success, non-zero on any failure.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import micromatch from 'micromatch';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const [,, filePath] = process.argv;

if (!filePath) {
  process.stderr.write('Usage: validate-findings <path-to-findings.json>\n');
  process.exit(1);
}

const absPath = path.resolve(filePath);

if (!fs.existsSync(absPath)) {
  process.stderr.write(`Error: file not found: ${absPath}\n`);
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(fs.readFileSync(absPath, 'utf8'));
} catch (err) {
  process.stderr.write(`Error: could not parse JSON: ${err.message}\n`);
  process.exit(1);
}

// ── JSON Schema ──────────────────────────────────────────────────────────────

const FINDINGS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'groove/findings.schema.json',
  title: 'Review findings',
  type: 'object',
  required: ['findings'],
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: { $ref: '#/$defs/finding' },
    },
  },
  $defs: {
    finding: {
      type: 'object',
      required: ['id', 'reviewer', 'priority', 'in_scope', 'title', 'description'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          pattern: '^fnd-[a-z0-9]+(-[a-z0-9]+)*$',
        },
        reviewer: { type: 'string' },
        priority: { type: 'string', enum: ['P1', 'P2', 'P3'] },
        in_scope: { type: 'boolean' },
        location: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string' },
            line_start: { type: 'integer', minimum: 1 },
            line_end: { type: 'integer', minimum: 1 },
          },
        },
        title: { type: 'string', minLength: 1, maxLength: 120 },
        description: { type: 'string', minLength: 1 },
        reproducer: { type: 'string' },
        suggested_fix: { type: 'string' },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(FINDINGS_SCHEMA);

const valid = validate(doc);
if (!valid) {
  for (const err of validate.errors) {
    process.stderr.write(`Schema error at ${err.instancePath || '(root)'}: ${err.message}\n`);
    if (err.params) {
      const detail = JSON.stringify(err.params);
      if (detail !== '{}') process.stderr.write(`  params: ${detail}\n`);
    }
  }
  process.exit(1);
}

// ── Extra checks ─────────────────────────────────────────────────────────────

const findings = doc.findings;
let failed = false;

// Unique id check
const ids = new Set();
for (const finding of findings) {
  if (ids.has(finding.id)) {
    process.stderr.write(`Error: duplicate finding id "${finding.id}"\n`);
    failed = true;
  }
  ids.add(finding.id);
}

// Reviewer reference check — parse .substrate/reviewers/INDEX.md
const reviewerIndexPath = path.resolve('.substrate/reviewers/INDEX.md');
let knownReviewerIds = null;

if (!fs.existsSync(reviewerIndexPath)) {
  process.stderr.write('Warning: .substrate/reviewers/INDEX.md not found — skipping reviewer reference check\n');
} else {
  knownReviewerIds = new Set();
  const indexContent = fs.readFileSync(reviewerIndexPath, 'utf8');
  // Parse markdown table rows: | ID | ... |
  for (const line of indexContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 1) continue;
    const idCell = cells[0];
    // Skip header row and separator row
    if (idCell === 'ID' || idCell.match(/^[-:]+$/)) continue;
    if (idCell) knownReviewerIds.add(idCell);
  }
}

for (const finding of findings) {
  if (knownReviewerIds !== null && !knownReviewerIds.has(finding.reviewer)) {
    process.stderr.write(
      `Error: finding "${finding.id}" references reviewer "${finding.reviewer}" which does not exist in .substrate/reviewers/INDEX.md\n`
    );
    failed = true;
  }
}

// in_scope check against plan.slices.yml
const slicesPath = path.resolve('docs/plan.slices.yml');
let allGlobs = null; // flat list of all touched_paths globs across all slices

if (!fs.existsSync(slicesPath)) {
  process.stderr.write('Warning: docs/plan.slices.yml not found — skipping in_scope check\n');
} else {
  let slicesDoc;
  try {
    slicesDoc = yaml.load(fs.readFileSync(slicesPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`Warning: could not parse docs/plan.slices.yml: ${err.message} — skipping in_scope check\n`);
  }
  if (slicesDoc?.slices) {
    allGlobs = slicesDoc.slices.flatMap(s => s.touched_paths ?? []);
  }
}

for (const finding of findings) {
  const locPath = finding.location?.path;
  if (!locPath) continue; // no location → skip in_scope check for this finding
  if (allGlobs === null) continue; // slices not available → skip

  const matches = allGlobs.length > 0 && micromatch.isMatch(locPath, allGlobs);

  if (finding.in_scope && !matches) {
    process.stderr.write(
      `Error: finding "${finding.id}" has in_scope=true but location.path "${locPath}" does not match any slice's touched_paths\n`
    );
    failed = true;
  } else if (!finding.in_scope && matches) {
    process.stderr.write(
      `Error: finding "${finding.id}" has in_scope=false but location.path "${locPath}" matches a slice glob\n`
    );
    failed = true;
  }
}

if (failed) process.exit(1);

process.stdout.write(`validate-findings: OK (${findings.length} finding${findings.length === 1 ? '' : 's'})\n`);
process.exit(0);
