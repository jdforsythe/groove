#!/usr/bin/env node
/**
 * validate-slices <path>
 *
 * Validates docs/plan.slices.yml against the §1 slice schema.
 * Extra checks beyond JSON Schema:
 *   - All slice ids are unique
 *   - Every dependency.id references a real slice id
 *   - id matches ^[a-z0-9]+(-[a-z0-9]+)*$  (already in schema pattern, belt-and-suspenders)
 *
 * Exits 0 on success, non-zero on any failure.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const [,, filePath] = process.argv;

if (!filePath) {
  process.stderr.write('Usage: validate-slices <path-to-plan.slices.yml>\n');
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

// ── JSON Schema ──────────────────────────────────────────────────────────────

const SLICE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'groove/slice.schema.json',
  title: 'Slice list',
  type: 'object',
  required: ['slices'],
  additionalProperties: false,
  properties: {
    slices: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/$defs/slice' },
    },
  },
  $defs: {
    slice: {
      type: 'object',
      required: ['id', 'title', 'acceptance_criteria', 'touched_paths', 'semantic_depends_on', 'out_of_scope'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
        },
        title: { type: 'string', minLength: 1, maxLength: 120 },
        acceptance_criteria: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', minLength: 1 },
        },
        touched_paths: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
        semantic_depends_on: {
          type: 'array',
          items: { $ref: '#/$defs/dependency' },
        },
        out_of_scope: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    dependency: {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(SLICE_SCHEMA);

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

const slices = doc.slices;
const ids = new Set();
let failed = false;

for (const slice of slices) {
  // Unique id check
  if (ids.has(slice.id)) {
    process.stderr.write(`Error: duplicate slice id "${slice.id}"\n`);
    failed = true;
  }
  ids.add(slice.id);
}

// Reference check (all dependency.id values must exist)
for (const slice of slices) {
  for (const dep of slice.semantic_depends_on ?? []) {
    if (!ids.has(dep.id)) {
      process.stderr.write(`Error: slice "${slice.id}" has dependency "${dep.id}" which does not exist\n`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);

process.stdout.write(`validate-slices: OK (${slices.length} slice${slices.length === 1 ? '' : 's'})\n`);
process.exit(0);
