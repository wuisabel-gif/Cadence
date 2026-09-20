#!/usr/bin/env node
import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyze, stripHtml, stripMarkdown, MAX_INPUT_BYTES } from '../skills/cadence/scripts/deslop.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3847;
const MAX_BODY = MAX_INPUT_BYTES + 64 * 1024;

export function scorePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('JSON object required');
  }
  if (typeof payload.text !== 'string') throw new TypeError('text must be a string');
  if ('html' in payload && typeof payload.html !== 'boolean') throw new TypeError('html must be a boolean');
  if ('markdown' in payload && typeof payload.markdown !== 'boolean') throw new TypeError('markdown must be a boolean');
  let prose = payload.text;
  if (payload.html) prose = stripHtml(prose);
  if (payload.markdown) prose = stripMarkdown(prose);
  return analyze(prose);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (chunk) => {
      n += chunk.length;
      if (n > MAX_BODY) {
        reject(Object.assign(new Error('body too large'), { status: 400 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createScoreServer() {
  return createServer(async (req, res) => {
    const send = (status, body) => {
      const json = JSON.stringify(body);
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(json) });
      res.end(json);
    };
    try {
      if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
      if (req.method !== 'POST' || req.url !== '/score') return send(404, { error: 'not found' });
      let payload;
      try { payload = JSON.parse((await readBody(req)).toString('utf8')); }
      catch { return send(400, { error: 'invalid JSON' }); }
      try { return send(200, scorePayload(payload)); }
      catch (error) {
        const status = error instanceof RangeError || error instanceof TypeError ? 400 : 500;
        return send(status, { error: error.message });
      }
    } catch (error) {
      if (!res.headersSent) send(error.status || 500, { error: error.message || 'request failed' });
    }
  });
}

function isMain() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMain()) {
  const server = createScoreServer();
  server.listen(PORT, HOST, () => {
    process.stderr.write(`Cadence score server on http://${HOST}:${PORT}/score\n`);
  });
}
