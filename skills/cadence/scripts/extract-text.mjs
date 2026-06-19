#!/usr/bin/env node
/**
 * Extract plain prose from a sample file so /cadence learn can profile it.
 *
 *   node extract-text.mjs <file.pdf|.txt|.md>   → prose on stdout
 *
 * .txt / .md are read directly. .pdf is extracted via Python's pypdf if it's
 * available (`pip install pypdf`); if it isn't, this prints a clear instruction
 * instead of failing silently. Keeping PDF support optional means the skill has
 * no hard runtime dependency for the common text case.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

const file = process.argv[2];
if (!file) {
  process.stderr.write('usage: node extract-text.mjs <file.pdf|.txt|.md>\n');
  process.exit(2);
}

const ext = extname(file).toLowerCase();

if (ext === '.txt' || ext === '.md' || ext === '') {
  process.stdout.write(readFileSync(file, 'utf8'));
  process.exit(0);
}

if (ext === '.pdf') {
  const py = `
import sys
try:
    from pypdf import PdfReader
except ImportError:
    sys.stderr.write("PDF extraction needs pypdf. Install it with: pip install pypdf\\n")
    sys.exit(3)
r = PdfReader(sys.argv[1])
print("\\n".join((p.extract_text() or "") for p in r.pages))
`;
  for (const bin of ['python3', 'python']) {
    const res = spawnSync(bin, ['-c', py, file], { encoding: 'utf8' });
    if (res.error) continue; // binary not found, try next
    if (res.status === 0) { process.stdout.write(res.stdout); process.exit(0); }
    process.stderr.write(res.stderr || '');
    process.exit(res.status ?? 1);
  }
  process.stderr.write('No python interpreter found for PDF extraction. ' +
    'Convert the PDF to .txt first, or install python3 + pypdf.\n');
  process.exit(3);
}

process.stderr.write(`Unsupported file type: ${ext}. Use .pdf, .txt, or .md, ` +
  'or paste the text directly.\n');
process.exit(2);
