import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import WebSocket, { WebSocketServer } from 'ws';
import { openAndWaitForClose } from './lifecycle.mjs';

function client(url) {
  const ws = new WebSocket(url);
  return { ws, open: () => once(ws, 'open') };
}

test('TCP reset during handshake fails without an unhandled rejection', async () => {
  const server = net.createServer(socket => socket.once('data', () => socket.resetAndDestroy()));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const connection = client(`ws://127.0.0.1:${server.address().port}`);
    await assert.rejects(openAndWaitForClose(connection), { code: 'ECONNRESET' });
    // node:test also fails on unhandled rejections emitted after the assertion.
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('immediate policy close preserves code 1008', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  server.on('connection', ws => ws.close(1008, 'Client limit'));
  try {
    const closed = await openAndWaitForClose(client(`ws://127.0.0.1:${server.address().port}`));
    assert.equal(closed[0], 1008);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('unexpected startup failure exits nonzero and writes failure evidence', async () => {
  // A responding port makes the harness fail its ownership check before spawning APIs.
  const server = net.createServer(socket => socket.once('data', () =>
    socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')));
  server.listen(5001, '127.0.0.1');
  await once(server, 'listening');
  const evidence = await mkdtemp(path.join(os.tmpdir(), 'chatbridge-harness-failure-'));
  try {
    await assert.rejects(promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('./run.mjs', import.meta.url))],
      { env: { ...process.env, EVIDENCE_DIR: evidence }, timeout: 15000 }),
    error => error.code === 1 && /Port 5001 already in use/.test(error.stderr));
    const result = JSON.parse(await readFile(path.join(evidence, 'gate1-results.json'), 'utf8'));
    assert.equal(result.status, 'FAIL');
    assert.match(result.errors[0].message, /Port 5001 already in use/);
    assert.ok(result.finished);
    assert.deepEqual(result.results, []);
    assert.equal(await readFile(path.join(evidence, 'gate1-services.txt'), 'utf8'), '');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
