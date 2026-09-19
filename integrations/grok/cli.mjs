#!/usr/bin/env node
import { dispatch, tools, parseArguments, MAX_REQUEST_BYTES } from './tools.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error('Expected one tool name, --help, or --list-tools.');
  const [name] = args;
  if (name === '--help' || name === '-h') {
    console.log('Usage: node integrations/grok/cli.mjs <cadence_analyze|cadence_voice>');
    console.log('Read one JSON argument object from stdin; write one JSON result to stdout.');
    console.log('--list-tools prints xAI Responses function definitions. Node 18+; local only.');
  } else if (name === '--list-tools') {
    console.log(JSON.stringify(tools));
  } else {
    if (!tools.some((tool) => tool.name === name)) throw new Error('Unknown Cadence tool name.');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) throw new RangeError('stdin exceeds the JSON byte limit.');
      chunks.push(chunk);
    }
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    console.log(JSON.stringify(dispatch(name, parseArguments(json))));
  }
} catch (error) {
  console.error(JSON.stringify({ error: { message: error.message } }));
  process.exitCode = 2;
}
