import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, analyzeParagraphs, stripHtml, stripMarkdown } from '../../skills/cadence/scripts/deslop.mjs';

// Seed names, not paths. Keep this list in sync with the checked-in voices.
export const VOICE_NAMES = Object.freeze([
  'column', 'counsel', 'dispatch', 'essence', 'kin', 'measured-academic',
  'plain', 'punchy', 'reckoning', 'seminar',
]);
export const MAX_TEXT_BYTES = 256 * 1024;
// JSON may encode each input byte as a six-byte Unicode escape.
export const MAX_REQUEST_BYTES = 6 * MAX_TEXT_BYTES + 4096;
const ROOT = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const tools = freeze([
  {
    type: 'function',
    name: 'cadence_analyze',
    description: 'Score supplied prose locally from 0 to 100 with Cadence. Measure before and after rewriting; this detects writing patterns, not authorship or factual quality. No files or URLs are opened.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        text: { type: 'string', maxLength: MAX_TEXT_BYTES, description: 'Text to score; at most 256 KiB UTF-8.' },
        html: { type: 'boolean', default: false, description: 'Strip HTML before scoring.' },
        prose_only: { type: 'boolean', default: false, description: 'Strip Markdown scaffolding after HTML conversion, if enabled.' },
        paragraphs: { type: 'boolean', default: false, description: 'Also return per-paragraph scores.' },
      },
      required: ['text'],
    },
  },
  {
    type: 'function',
    name: 'cadence_voice',
    description: 'Read a complete bundled Cadence writing voice and the shared writing rules before drafting or rewriting. Preserve facts and layout. These are prose profiles, not speech voices.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { name: { type: 'string', enum: [...VOICE_NAMES] } },
      required: ['name'],
    },
  },
]);

export function parseArguments(json) {
  if (typeof json !== 'string') throw new TypeError('Tool arguments must be a JSON string.');
  if (Buffer.byteLength(json, 'utf8') > MAX_REQUEST_BYTES) throw new RangeError('Tool arguments exceed the JSON byte limit.');
  try { return JSON.parse(json); } catch { throw new TypeError('Tool arguments must contain valid JSON.'); }
}

function validateObject(args, allowed, required) {
  if (!args || typeof args !== 'object' || Array.isArray(args)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(args))) {
    throw new TypeError('Tool arguments must be an object.');
  }
  if (Object.keys(args).some((key) => !allowed.includes(key))) throw new TypeError('Unknown tool argument.');
  for (const key of required) {
    if (!Object.hasOwn(args, key)) throw new TypeError(`Missing required argument: ${key}.`);
  }
}

// Only host-owned, fixed relative paths reach here. Reject symlinks in every
// bundled component, and open the final regular file without following links.
function readBundled(parts) {
  let path = ROOT;
  for (const [index, part] of parts.entries()) {
    path = join(path, part);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error('Bundled profile/rules must be regular files in real directories.');
    }
  }
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_TEXT_BYTES) throw new Error('Invalid or oversized bundled profile/rules.');
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
}

export function dispatch(name, args) {
  if (name === 'cadence_analyze') {
    validateObject(args, ['text', 'html', 'prose_only', 'paragraphs'], ['text']);
    if (typeof args.text !== 'string') throw new TypeError('text must be a string.');
    if (Buffer.byteLength(args.text, 'utf8') > MAX_TEXT_BYTES) throw new RangeError('text exceeds the 256 KiB UTF-8 limit.');
    const flags = {};
    for (const flag of ['html', 'prose_only', 'paragraphs']) {
      if (Object.hasOwn(args, flag) && typeof args[flag] !== 'boolean') throw new TypeError(`${flag} must be a boolean.`);
      flags[flag] = Object.hasOwn(args, flag) ? args[flag] : false;
    }
    let text = args.text;
    if (flags.html) text = stripHtml(text);
    if (flags.prose_only) text = stripMarkdown(text);
    const result = analyze(text);
    if (flags.paragraphs) result.paragraphs = analyzeParagraphs(text);
    return result;
  }
  if (name === 'cadence_voice') {
    validateObject(args, ['name'], ['name']);
    if (typeof args.name !== 'string' || !VOICE_NAMES.includes(args.name)) throw new TypeError('Unknown Cadence voice name.');
    return {
      name: args.name,
      profile: readBundled(['voices', `${args.name}.md`]),
      rules: readBundled(['skills', 'cadence', 'AGENTS.md']),
    };
  }
  throw new TypeError('Unknown Cadence tool name.');
}
