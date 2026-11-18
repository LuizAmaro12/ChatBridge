import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = path.join(root, 'docs/evidence');
const serviceKey = randomBytes(32).toString('hex');
const roles = ['web', 'mobile'];
const configs = Object.fromEntries(roles.map((role, i) => [role, {
  port: 5001 + i, key: randomBytes(32).toString('hex'), password: randomBytes(24).toString('hex')
}]));
const processes = new Map();
const sockets = new Set();
const results = [];
const logs = [];
const started = new Date().toISOString();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = role => `http://127.0.0.1:${configs[role].port}`;

async function test(id, expected, action) {
  const before = Date.now();
  try {
    const observed = await action();
    results.push({ id, expected, observed: observed ?? 'Asserções satisfeitas', status: 'PASS', ms: Date.now() - before });
    console.log(`PASS ${id}`);
  } catch (error) {
    results.push({ id, expected, observed: error.message, status: 'FAIL', ms: Date.now() - before });
    throw error;
  }
}

async function waitFor(action, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await action()) return; } catch { /* Retry until explicit timeout. */ }
    await sleep(100);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

async function start(role, extra = {}) {
  const cfg = configs[role];
  const proc = spawn('dotnet', [path.join(root, `services/${role}-api/bin/Debug/net10.0/ChatBridge.Api.dll`)], {
    cwd: root, windowsHide: true, env: { ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: base(role),
      Auth__Issuer: `chatbridge-${role}`, Auth__Audience: `chatbridge-${role}-client`,
      Auth__SigningKey: cfg.key, Auth__TokenSeconds: '3600',
      DemoUser__Username: `${role}-demo`, DemoUser__Name: `Usuário ${role}`, DemoUser__Password: cfg.password,
      Interbackend__ServiceKey: serviceKey, Interbackend__Url: 'ws://127.0.0.1:5002/internal/ws',
      Cors__AllowedOrigin: 'http://localhost:3000', ...extra
    }
  });
  processes.set(role, proc);
  proc.on('error', error => logs.push(`${role}: spawn ${error.message}`));
  for (const stream of [proc.stdout, proc.stderr]) stream.on('data', bytes => logs.push(`${role}: ${bytes}`));
  await waitFor(async () => {
    if (proc.exitCode !== null) throw new Error(`${role} exited ${proc.exitCode}`);
    return (await fetch(base(role) + '/health')).ok;
  });
}

async function stop(role) {
  const proc = processes.get(role);
  if (!proc || proc.exitCode !== null) return;
  const exited = once(proc, 'exit');
  proc.kill();
  await exited;
  processes.delete(role);
}

async function login(role, password = configs[role].password) {
  const response = await fetch(base(role) + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `${role}-demo`, password })
  });
  return { status: response.status, body: await response.json() };
}

function client(role, token, { route = '/ws/chat', headers = {}, origin = 'http://localhost:3000' } = {}) {
  const url = base(role).replace('http:', 'ws:') + route + (token ? `?access_token=${token}` : '');
  const ws = new WebSocket(url, { headers: { ...(origin ? { Origin: origin } : {}), ...headers } });
  sockets.add(ws);
  const queue = [];
  ws.on('message', data => { queue.push(JSON.parse(data.toString())); });
  ws.on('error', () => {});
  ws.on('close', () => sockets.delete(ws));
  return {
    ws, queue,
    open: () => new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('unexpected-response', (_, response) => { ws.terminate(); reject(new Error(`HTTP ${response.statusCode}`)); });
      ws.once('error', reject);
    }),
    send: value => ws.send(JSON.stringify(value)),
    async take(predicate, timeout = 7000) {
      let result;
      await waitFor(() => {
        const index = queue.findIndex(predicate);
        if (index < 0) return false;
        result = queue.splice(index, 1)[0];
        return true;
      }, timeout);
      return result;
    }
  };
}

async function rejectSocket(role, token, status, options) {
  const c = client(role, token, options);
  await assert.rejects(c.open(), new RegExp(`HTTP ${status}`));
}

async function connected() {
  await waitFor(async () => (await (await fetch(base('web') + '/health')).json()).interbackend === 'connected');
}

async function exchange(from, to, content) {
  const messageId = randomUUID();
  from.send({ type: 'chat.send', messageId, content });
  const message = await to.take(m => m.type === 'chat.message' && m.messageId === messageId);
  const ack = await from.take(m => m.type === 'chat.ack' && m.messageId === messageId);
  assert.equal(message.content, content.trim());
  assert.equal(ack.status, 'remote_received');
  return message;
}

function signedToken(role, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: `${role}-demo`, name: `Usuário ${role}`,
    iss: `chatbridge-${role}`, aud: `chatbridge-${role}-client`, nbf: now - 10, exp: now + 3600, ...overrides })).toString('base64url');
  const signature = createHmac('sha256', configs[role].key).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

let web, mobile, tokens;
try {
  // Do not terminate or reuse someone else's services.
  for (const role of roles) {
    let occupied = false;
    try { await fetch(base(role) + '/health', { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
    assert.equal(occupied, false, `Port ${configs[role].port} already in use`);
  }
  await start('mobile');
  await start('web');
  await connected();
  await test('T01-T03 login', '200 para contas válidas, 401 genérico para inválidas nas duas APIs', async () => {
    tokens = {};
    for (const role of roles) {
      const valid = await login(role);
      assert.equal(valid.status, 200);
      assert.equal(valid.body.user.id, `${role}-demo`);
      tokens[role] = valid.body.accessToken;
      const invalid = await login(role, 'incorrect');
      assert.equal(invalid.status, 401);
      assert.equal(invalid.body.code, 'invalid_credentials');
    }
  });
  await test('T07-T13-T19 handshake', 'Rejeitar JWT ausente/inválido/cruzado/expirado, serviço sem chave e Origin indevido', async () => {
    for (const role of roles) {
      await rejectSocket(role, null, 401);
      await rejectSocket(role, 'invalid', 401);
      await rejectSocket(role, tokens[role === 'web' ? 'mobile' : 'web'], 401);
      await rejectSocket(role, signedToken(role, { exp: 1 }), 401);
      await rejectSocket(role, signedToken(role, { iss: 'wrong' }), 401);
      await rejectSocket(role, signedToken(role, { aud: 'wrong' }), 401);
    }
    await rejectSocket('web', tokens.web, 403, { origin: 'http://evil.invalid' });
    await rejectSocket('web', tokens.web, 403, { origin: null });
    await rejectSocket('mobile', null, 401, { route: '/internal/ws' });
    await rejectSocket('mobile', null, 401, { route: '/internal/ws', headers: { Authorization: `Bearer ${tokens.mobile}` } });
    await rejectSocket('mobile', null, 409, { route: '/internal/ws', headers: { Authorization: `Bearer ${serviceKey}` } });
  });
  web = client('web', tokens.web);
  mobile = client('mobile', tokens.mobile, { origin: null });
  await Promise.all([web.open(), mobile.open()]);
  await test('T04 web-to-mobile', 'Cliente mobile recebe texto e autor web; remetente recebe ACK correlacionado', async () => {
    const m = await exchange(web, mobile, '  Web → Mobile: integração real  ');
    assert.equal(m.senderId, 'web-demo'); assert.equal(m.origin, 'web');
    return { messageId: m.messageId, content: m.content, senderId: m.senderId, origin: m.origin };
  });
  await test('T05 mobile-to-web', 'Cliente web recebe texto e autor mobile; remetente recebe ACK correlacionado', async () => {
    const m = await exchange(mobile, web, 'Mobile → Web: integração real');
    assert.equal(m.senderId, 'mobile-demo'); assert.equal(m.origin, 'mobile');
    return { messageId: m.messageId, content: m.content, senderId: m.senderId, origin: m.origin };
  });
  await test('T08 trusted identity', 'Campos de identidade falsos não substituem claims autenticadas', async () => {
    const messageId = randomUUID();
    web.send({ type: 'chat.send', messageId, content: 'Identidade real', senderId: 'attacker',
      senderName: 'attacker', origin: 'mobile', timestamp: '2000-01-01T00:00:00Z' });
    const message = await mobile.take(m => m.messageId === messageId);
    assert.equal(message.senderId, 'web-demo'); assert.equal(message.senderName, 'Usuário web');
    assert.equal(message.origin, 'web'); assert.notEqual(message.timestamp, '2000-01-01T00:00:00Z');
    await web.take(m => m.type === 'chat.ack' && m.messageId === messageId);
  });
  await test('T06-T11 validation', 'Rejeitar conteúdo vazio, formato inválido, tipos não permitidos e sala inválida; manter API operacional', async () => {
    for (const c of [web, mobile]) {
      for (const content of [null, '', '   ', 'x'.repeat(2001)]) {
        const messageId = randomUUID(); c.send({ type: 'chat.send', messageId, content });
        const error = await c.take(m => m.messageId === messageId);
        assert.equal(error.type, 'chat.error');
        assert.equal(error.code, content?.length === 2001 ? 'content_too_long' : 'invalid_content');
      }
      for (const [payload, code] of [
        [{ type: 'chat.send', messageId: 'invalid', content: 'x' }, 'invalid_message_id'],
        [{ type: 'chat.ack', messageId: randomUUID() }, 'unsupported_type'],
        [{ type: 'chat.send', messageId: randomUUID(), content: 'x', roomId: 'other' }, 'invalid_room']
      ]) {
        c.send(payload); assert.equal((await c.take(m => m.type === 'chat.error')).code, code);
      }
      c.ws.send('{broken'); assert.equal((await c.take(m => m.type === 'chat.error')).code, 'invalid_json');
      c.ws.send('{"type":"chat.send","type":"chat.ack"}');
      assert.equal((await c.take(m => m.type === 'chat.error')).code, 'invalid_payload');
    }
    await exchange(web, mobile, 'x'.repeat(2000));
  });
  await test('T09-T10 mobile outage', 'Falha sem falso ACK; reiniciar Mobile API recupera ambos sentidos', async () => {
    await stop('mobile');
    await waitFor(async () => (await (await fetch(base('web') + '/health')).json()).interbackend !== 'connected');
    const messageId = randomUUID(); web.send({ type: 'chat.send', messageId, content: 'Durante falha' });
    assert.equal((await web.take(m => m.messageId === messageId)).code, 'remote_unavailable');
    assert.equal(web.queue.some(m => m.messageId === messageId && m.type === 'chat.ack'), false);
    await start('mobile'); await connected();
    mobile = client('mobile', tokens.mobile, { origin: null }); await mobile.open();
    await exchange(web, mobile, 'Após recuperação mobile');
    await exchange(mobile, web, 'Retorno após recuperação mobile');
  });
  await test('T09-T10 web outage', 'Falha mobile sem falso ACK; reiniciar Web API recupera ambos sentidos', async () => {
    await stop('web');
    await waitFor(async () => (await (await fetch(base('mobile') + '/health')).json()).interbackend === 'disconnected');
    const messageId = randomUUID(); mobile.send({ type: 'chat.send', messageId, content: 'Durante falha web' });
    assert.equal((await mobile.take(m => m.messageId === messageId)).code, 'remote_unavailable');
    await start('web'); await connected();
    web = client('web', tokens.web); await web.open();
    await exchange(mobile, web, 'Após recuperação web');
    await exchange(web, mobile, 'Retorno após recuperação web');
  });
  console.log('P0 VERIFIED');
  await test('T12 deduplication and concurrency', 'Duplicatas simultâneas geram uma publicação; conflito rejeitado; sem eco', async () => {
    const messageId = randomUUID();
    const payload = { type: 'chat.send', messageId, content: 'Duplicata concorrente' };
    web.send(payload); web.send(payload); web.send(payload);
    await mobile.take(m => m.messageId === messageId && m.type === 'chat.message');
    for (let i = 0; i < 3; i++) await web.take(m => m.messageId === messageId && m.type === 'chat.ack');
    await sleep(250);
    assert.equal(mobile.queue.some(m => m.messageId === messageId), false);
    assert.equal(web.queue.some(m => m.messageId === messageId && m.type === 'chat.message'), false);
    web.send({ ...payload, content: 'Conflito' });
    assert.equal((await web.take(m => m.messageId === messageId)).code, 'duplicate_conflict');
    await Promise.all(Array.from({ length: 10 }, (_, i) => exchange(web, mobile, `Concorrente ${i}`)));
  });
  await test('T11 frames', 'Fragmentação válida aceita; binário fecha 1003 e >16KiB fecha 1009', async () => {
    const messageId = randomUUID();
    const payload = JSON.stringify({ type: 'chat.send', messageId, content: 'Mensagem fragmentada' });
    web.ws.send(payload.slice(0, 30), { fin: false });
    web.ws.send(payload.slice(30), { fin: true });
    await mobile.take(m => m.messageId === messageId);
    await web.take(m => m.messageId === messageId && m.type === 'chat.ack');
    for (const [value, code] of [[Buffer.from([1, 2, 3]), 1003], ['x'.repeat(16385), 1009]]) {
      const c = client('web', tokens.web); await c.open();
      const closed = once(c.ws, 'close'); c.ws.send(value);
      assert.equal((await closed)[0], code);
    }
    await exchange(mobile, web, 'API viva após frames inválidos');
  });
  await test('T07 active expiration', 'Socket autenticado fecha 1008 no vencimento sem precisar enviar mensagem', async () => {
    const c = client('web', signedToken('web', { exp: Math.floor(Date.now() / 1000) + 2 }));
    await c.open();
    const closed = once(c.ws, 'close');
    assert.equal((await closed)[0], 1008);
  });
  await test('T15 offline recipient', 'Backend aceita sem dispositivo; reconexão não recebe histórico', async () => {
    const closed = once(mobile.ws, 'close'); mobile.ws.close(); await closed;
    const messageId = randomUUID(); web.send({ type: 'chat.send', messageId, content: 'Destinatário offline' });
    assert.equal((await web.take(m => m.messageId === messageId)).status, 'remote_received');
    mobile = client('mobile', tokens.mobile, { origin: null }); await mobile.open();
    await sleep(200);
    assert.equal(mobile.queue.some(m => m.messageId === messageId), false);
  });
  // Fault injection only: real Web API + controlled WS peer, not evidence for T04/T05.
  for (const ws of sockets) ws.terminate();
  await stop('web'); await stop('mobile');
  const fakePeer = new WebSocketServer({ host: '127.0.0.1', port: 5002 });
  await once(fakePeer, 'listening');
  let fakeConnection;
  let answerHeartbeat = true;
  let received = [];
  const peerResponses = [];
  let fakeConnections = 0;
  fakePeer.on('connection', (ws, request) => {
    assert.equal(request.headers.authorization, `Bearer ${serviceKey}`);
    fakeConnections++;
    fakeConnection = ws;
    ws.on('message', data => {
      const m = JSON.parse(data.toString());
      if (m.type === 'connection.ping' && answerHeartbeat)
        ws.send(JSON.stringify({ type: 'connection.pong', nonce: m.nonce }));
      if (m.type === 'chat.message') received.push(m);
      if (m.type === 'chat.ack' || m.type === 'chat.error') peerResponses.push(m);
    });
  });
  try {
    await start('web', { Interbackend__HeartbeatSeconds: '1' }); await connected();
    web = client('web', tokens.web); await web.open();
    await test('T11-T12 remote validation and deduplication', 'Peer inválido recebe erro; duplicata remota publica uma vez e repete ACK', async () => {
      fakeConnection.send('{broken');
      await waitFor(() => peerResponses.some(m => m.code === 'invalid_json'));
      const messageId = randomUUID();
      const payload = { type: 'chat.message', messageId, roomId: 'general', origin: 'mobile',
        senderId: 'mobile-demo', senderName: 'Usuário mobile', content: 'Remota duplicada', timestamp: new Date().toISOString() };
      fakeConnection.send(JSON.stringify(payload)); fakeConnection.send(JSON.stringify(payload));
      await web.take(m => m.messageId === messageId && m.type === 'chat.message');
      await waitFor(() => peerResponses.filter(m => m.messageId === messageId && m.type === 'chat.ack').length === 2);
      await sleep(200); assert.equal(web.queue.some(m => m.messageId === messageId), false);
      fakeConnection.send(JSON.stringify({ ...payload, content: 'Conteúdo conflitante' }));
      await waitFor(() => peerResponses.some(m => m.messageId === messageId && m.code === 'duplicate_conflict'));
      const badId = randomUUID();
      fakeConnection.send(JSON.stringify({ ...payload, messageId: badId, origin: 'web' }));
      await waitFor(() => peerResponses.some(m => m.messageId === badId && m.code === 'invalid_payload'));
    });
    await test('T14 ACK timeout and late ACK', 'Timeout após 5s é incerto; sem reenvio automático; ACK tardio/aleatório ignorado', async () => {
      const messageId = randomUUID(); const before = Date.now();
      web.send({ type: 'chat.send', messageId, content: 'ACK suprimido' });
      const result = await web.take(m => m.messageId === messageId);
      assert.equal(result.code, 'ack_timeout'); assert.match(result.message, /pode ter chegado/);
      assert.ok(Date.now() - before >= 4500);
      assert.equal(received.filter(m => m.messageId === messageId).length, 1);
      fakeConnection.send(JSON.stringify({ type: 'chat.ack', messageId, status: 'remote_received' }));
      fakeConnection.send(JSON.stringify({ type: 'chat.ack', messageId: randomUUID(), status: 'remote_received' }));
      await sleep(300);
      assert.equal(web.queue.some(m => m.type === 'chat.ack'), false);
      return { messageId, code: result.code, peerReceipts: 1, elapsedMs: Date.now() - before };
    });
    await test('T14 disconnect during pending ACK', 'Perda após recepção resulta em connection_lost incerto', async () => {
      const messageId = randomUUID(); web.send({ type: 'chat.send', messageId, content: 'Cortar antes do ACK' });
      await waitFor(() => received.some(m => m.messageId === messageId)); fakeConnection.terminate();
      const result = await web.take(m => m.messageId === messageId);
      assert.equal(result.code, 'connection_lost'); assert.match(result.message, /pode ter chegado/);
      await connected();
    });
    await test('T16 heartbeat reconnect', 'Peer sem pong é desconectado e nova conexão ocorre', async () => {
      const before = fakeConnections; answerHeartbeat = false;
      await waitFor(() => fakeConnections > before, 12000);
      answerHeartbeat = true;
      await connected();
      return { before, after: fakeConnections, heartbeatSecondsForTest: 1 };
    });
    await test('T17 pending limit', 'No máximo 100 encaminhamentos pendentes; excesso retorna busy', async () => {
      const second = client('web', tokens.web); await second.open();
      const ids = Array.from({ length: 100 }, () => randomUUID());
      for (const messageId of ids) web.send({ type: 'chat.send', messageId, content: 'Pendente' });
      await waitFor(() => received.filter(m => ids.includes(m.messageId)).length === 100);
      const overflow = randomUUID(); second.send({ type: 'chat.send', messageId: overflow, content: 'Excesso' });
      assert.equal((await second.take(m => m.messageId === overflow)).code, 'busy');
      fakeConnection.terminate();
      for (const id of ids) assert.equal((await web.take(m => m.messageId === id)).code, 'connection_lost');
      second.ws.close();
      await connected();
    });
  } finally {
    await stop('web');
    for (const ws of fakePeer.clients) ws.terminate();
    await new Promise(resolve => fakePeer.close(resolve));
  }
  await test('T17 cache capacity and retention', 'Cache limitado rejeita excesso e libera após retenção; conexão excedente fecha 1008', async () => {
    await start('mobile');
    await start('web', { Chat__CacheLimit: '2', Chat__RetentionSeconds: '2', Chat__MaxClients: '1' });
    await connected();
    web = client('web', tokens.web); mobile = client('mobile', tokens.mobile, { origin: null });
    await Promise.all([web.open(), mobile.open()]);
    const extra = client('web', tokens.web);
    const extraClosed = once(extra.ws, 'close'); await extra.open();
    assert.equal((await extraClosed)[0], 1008);
    await exchange(web, mobile, 'Cache 1'); await exchange(web, mobile, 'Cache 2');
    const messageId = randomUUID(); web.send({ type: 'chat.send', messageId, content: 'Cache cheio' });
    assert.equal((await web.take(m => m.messageId === messageId)).code, 'busy');
    await sleep(2100);
    await exchange(web, mobile, 'Cache liberado');
  });
  console.log('P1 VERIFIED (see documented limits)');
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  for (const ws of sockets) ws.terminate();
  for (const role of roles) await stop(role);
  await mkdir(evidence, { recursive: true });
  const allLogs = logs.join('\n');
  for (const secret of [serviceKey, ...roles.flatMap(r => [configs[r].key, configs[r].password]), ...Object.values(tokens ?? {})])
    assert.equal(allLogs.includes(secret), false, 'Secret appeared in logs');
  await writeFile(path.join(evidence, 'gate1-results.json'), JSON.stringify({ started, finished: new Date().toISOString(),
    node: process.version, platform: process.platform, results }, null, 2) + '\n');
  await writeFile(path.join(evidence, 'gate1-services.txt'), allLogs);
}
