import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { analyze } from '../skills/cadence/scripts/deslop.mjs';
import { scorePayload, createScoreServer } from '../examples/score-server.mjs';

const SAMPLE = "In today's world, a robust solution is crucial. We must leverage synergy to unlock potential.";
const CLEAN = 'The bus arrived. I got on.';

test('embed sample matches the documented detector result', () => {
  const result = analyze(SAMPLE);
  assert.equal(result.score, 22);
  assert.equal(result.grade, 'B');
  assert.equal(result.metrics.sentences, 2);
  assert.deepEqual(result.findings.map((f) => f.rule), [
    'banned-phrase', 'hollow-confidence', 'hollow-confidence', 'hollow-confidence', 'hollow-confidence',
  ]);
  assert.deepEqual(scorePayload({ text: SAMPLE }), result);
});

test('score server returns detector JSON on localhost and rejects bad input', async () => {
  const server = createScoreServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const post = async (path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    return { status: res.status, json: await res.json() };
  };
  try {
    const ok = await post('/score', JSON.stringify({ text: CLEAN }));
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json, analyze(CLEAN));
    const html = await post('/score', JSON.stringify({ text: '<p>The bus arrived. I got on.</p>', html: true }));
    assert.equal(html.status, 200);
    assert.equal(html.json.metrics.sentences, 2);
    assert.equal((await post('/nope', '{}')).status, 404);
    assert.equal((await post('/score', '{')).status, 400);
    assert.equal((await post('/score', JSON.stringify({ text: 4 }))).status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('example server is not an open HTTP listener when imported', () => {
  assert.equal(typeof createHttpServer, 'function');
  assert.equal(typeof createScoreServer().listening, 'boolean');
  assert.equal(createScoreServer().listening, false);
});
