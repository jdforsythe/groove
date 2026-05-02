#!/usr/bin/env node
/**
 * validate-substrate <dir>
 *
 * For every .md file in .substrate/<type>/ directories, parses YAML frontmatter
 * and validates against the per-type schema (§4a–4f). Also enforces Markdown
 * section conventions:
 *   - ADR must have ## Summary, ## Context, ## Decision, ## Alternatives considered,
 *     ## Consequences
 *   - anti-pattern body must contain the rule (never ...), reason (because ...), and
 *     a positive example (## Example or "For example" or similar)
 *
 * Exits 0 on success (including empty directory), non-zero on any failure.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const [,, dirPath] = process.argv;

if (!dirPath) {
  process.stderr.write('Usage: validate-substrate <path-to-.substrate/>\n');
  process.exit(1);
}

const absDir = path.resolve(dirPath);

if (!fs.existsSync(absDir)) {
  process.stderr.write(`Error: directory not found: ${absDir}\n`);
  process.exit(1);
}

// ── JSON Schemas ─────────────────────────────────────────────────────────────

const BASE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'groove/substrate-frontmatter-base.schema.json',
  type: 'object',
  required: ['id', 'type', 'description', 'created'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
    type: { type: 'string', enum: ['vocabulary', 'adr', 'anti-pattern', 'solution', 'reviewer'] },
    description: { type: 'string', minLength: 1, maxLength: 200 },
    created: { type: 'string', format: 'date' },
    supersedes: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

const ADR_SCHEMA = {
  allOf: [
    BASE_SCHEMA,
    {
      type: 'object',
      properties: {
        type: { const: 'adr' },
        status: { type: 'string', enum: ['accepted', 'superseded', 'deprecated'] },
      },
      required: ['status'],
    },
  ],
};

const ANTI_PATTERN_SCHEMA = {
  allOf: [
    BASE_SCHEMA,
    {
      type: 'object',
      properties: {
        type: { const: 'anti-pattern' },
        scope: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
      },
      required: ['scope'],
    },
  ],
};

const SOLUTION_SCHEMA = {
  allOf: [
    BASE_SCHEMA,
    {
      type: 'object',
      properties: {
        type: { const: 'solution' },
        scope: { type: 'array', items: { type: 'string' } },
        tags: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
        worked_example_url: { type: 'string', format: 'uri' },
      },
      required: ['tags'],
    },
  ],
};

// Predicate DSL schema (inline, self-contained with recursive $ref: '#')
const PREDICATE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://groove/predicate.schema.json',
  oneOf: [
    { $ref: '#/$defs/leaf' },
    { $ref: '#/$defs/composite' },
  ],
  $defs: {
    leaf: {
      type: 'object',
      oneOf: [
        {
          required: ['paths'],
          additionalProperties: false,
          properties: { paths: { type: 'array', items: { type: 'string' } } },
        },
        {
          required: ['new_files_in'],
          additionalProperties: false,
          properties: { new_files_in: { type: 'array', items: { type: 'string' } } },
        },
        {
          required: ['diff_contains'],
          additionalProperties: false,
          properties: { diff_contains: { type: 'array', items: { type: 'string' } } },
        },
        {
          required: ['always'],
          additionalProperties: false,
          properties: { always: { type: 'boolean', const: true } },
        },
      ],
    },
    composite: {
      type: 'object',
      oneOf: [
        {
          required: ['any'],
          additionalProperties: false,
          properties: { any: { type: 'array', minItems: 1, items: { $ref: 'https://groove/predicate.schema.json' } } },
        },
        {
          required: ['all'],
          additionalProperties: false,
          properties: { all: { type: 'array', minItems: 1, items: { $ref: 'https://groove/predicate.schema.json' } } },
        },
        {
          required: ['not'],
          additionalProperties: false,
          properties: { not: { $ref: 'https://groove/predicate.schema.json' } },
        },
      ],
    },
  },
};

const REVIEWER_SCHEMA = {
  allOf: [
    BASE_SCHEMA,
    {
      type: 'object',
      properties: {
        type: { const: 'reviewer' },
        predicate: { $ref: 'https://groove/predicate.schema.json' },
        priority_floor: { type: 'string', enum: ['P1', 'P2', 'P3'] },
        category: { type: 'string' },
      },
      required: ['predicate', 'category'],
    },
  ],
};

// vocabulary uses the base schema unchanged
const VOCABULARY_SCHEMA = BASE_SCHEMA;

const SCHEMAS_BY_TYPE = {
  vocabulary: VOCABULARY_SCHEMA,
  adr: ADR_SCHEMA,
  'anti-pattern': ANTI_PATTERN_SCHEMA,
  solution: SOLUTION_SCHEMA,
  reviewer: REVIEWER_SCHEMA,
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
// Add predicate schema so $ref works
ajv.addSchema(PREDICATE_SCHEMA);

const validators = {};
for (const [type, schema] of Object.entries(SCHEMAS_BY_TYPE)) {
  validators[type] = ajv.compile(schema);
}

// ── Frontmatter parser ───────────────────────────────────────────────────────

function parseFrontmatter(content) {
  // YAML frontmatter is between the first pair of --- delimiters
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatterRaw: null, body: content };
  return { frontmatterRaw: match[1], body: match[2] };
}

// ── Walk the substrate directory ─────────────────────────────────────────────

// Known substrate type directories
const KNOWN_TYPES = ['vocabulary', 'adr', 'anti-pattern', 'solution', 'reviewers'];

let failed = false;
let fileCount = 0;

// Collect all .md files in each type directory (excluding INDEX.md)
for (const typeDirName of KNOWN_TYPES) {
  const typeDir = path.join(absDir, typeDirName);
  if (!fs.existsSync(typeDir)) continue;

  // Map directory name to schema type (reviewers dir → reviewer type)
  const schemaType = typeDirName === 'reviewers' ? 'reviewer' : typeDirName;

  const entries = fs.readdirSync(typeDir);
  for (const entry of entries) {
    if (!entry.endsWith('.md') || entry === 'INDEX.md') continue;
    const filePath = path.join(typeDir, entry);
    const content = fs.readFileSync(filePath, 'utf8');
    fileCount++;

    const { frontmatterRaw, body } = parseFrontmatter(content);
    if (!frontmatterRaw) {
      process.stderr.write(`Error: ${filePath}: missing YAML frontmatter\n`);
      failed = true;
      continue;
    }

    // Parse YAML frontmatter
    // Use JSON_SCHEMA to prevent js-yaml from auto-parsing dates as Date objects
    let fm;
    try {
      fm = yaml.load(frontmatterRaw, { schema: yaml.JSON_SCHEMA });
    } catch (err) {
      process.stderr.write(`Error: ${filePath}: invalid YAML frontmatter: ${err.message}\n`);
      failed = true;
      continue;
    }

    if (typeof fm !== 'object' || fm === null) {
      process.stderr.write(`Error: ${filePath}: frontmatter is not a YAML object\n`);
      failed = true;
      continue;
    }

    // Validate type field matches directory
    if (fm.type !== schemaType) {
      process.stderr.write(
        `Error: ${filePath}: frontmatter type "${fm.type}" does not match directory type "${schemaType}"\n`
      );
      failed = true;
    }

    // Validate against the appropriate schema
    const validator = validators[schemaType];
    if (!validator) {
      process.stderr.write(`Warning: ${filePath}: unknown substrate type "${schemaType}" — skipping schema check\n`);
      continue;
    }

    const valid = validator(fm);
    if (!valid) {
      for (const err of validator.errors) {
        process.stderr.write(
          `Error: ${filePath}: frontmatter schema error at ${err.instancePath || '(root)'}: ${err.message}\n`
        );
      }
      failed = true;
    }

    // ── Markdown body conventions ──────────────────────────────────────────

    if (schemaType === 'adr') {
      const required = ['## Summary', '## Context', '## Decision', '## Alternatives considered', '## Consequences'];
      for (const section of required) {
        if (!body.includes(section)) {
          process.stderr.write(`Error: ${filePath}: ADR body is missing section "${section}"\n`);
          failed = true;
        }
      }
    }

    if (schemaType === 'anti-pattern') {
      // Must state the rule (never X), reason (because Y), and a positive example
      const bodyLower = body.toLowerCase();
      if (!bodyLower.includes('never ') && !bodyLower.includes('do not ') && !bodyLower.includes('avoid ')) {
        process.stderr.write(
          `Error: ${filePath}: anti-pattern body must state the rule (include "never", "do not", or "avoid")\n`
        );
        failed = true;
      }
      if (!bodyLower.includes('because ') && !bodyLower.includes('reason') && !bodyLower.includes('why')) {
        process.stderr.write(
          `Error: ${filePath}: anti-pattern body must state the reason (include "because", "reason", or "why")\n`
        );
        failed = true;
      }
      if (
        !bodyLower.includes('for example') &&
        !bodyLower.includes('example:') &&
        !body.includes('## Example') &&
        !body.includes('## Positive example') &&
        !body.includes('## Instead') &&
        !body.includes('## Do this instead')
      ) {
        process.stderr.write(
          `Error: ${filePath}: anti-pattern body must include a positive example\n`
        );
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);

process.stdout.write(`validate-substrate: OK (${fileCount} file${fileCount === 1 ? '' : 's'} checked)\n`);
process.exit(0);
