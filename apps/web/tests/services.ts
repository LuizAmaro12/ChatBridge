import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { once } from 'node:events';

const root = path.resolve('../..');
type Role = 'web' | 'mobile';
const serviceKey = randomBytes(32).toString('hex');
export const credentials = {
  web: { username: 'web-demo', password: randomBytes(24).toString('hex') },
  mobile: { username: 'mobile-demo', password: randomBytes(24).toString('hex') },
};
const keys = { web: randomBytes(32).toString('hex'), mobile: randomBytes(32).toString('hex') };
const processes = new Map<Role, ChildProcess>();
const base = (role: Role) => `http://localhost:${role === 'web' ? 5001 : 5002}`;
export async function until(condition: () => boolean | Promise<boolean>, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Condição de teste não satisfeita no prazo.');
}
export async function assertServicesFree() {
  for (const role of ['web', 'mobile'] as const) {
    let occupied = false;
    try { await fetch(base(role) + '/health', { signal: AbortSignal.timeout(500) }); occupied = true; }
    catch { /* Connection refused is expected when the test port is free. */ }
    if (occupied) throw new Error(`A porta da API ${role} está ocupada. Pare a API antes dos testes.`);
  }
}
export async function start(role: Role, tokenSeconds = 3600) {
  const proc = spawn('dotnet', [path.join(root, `services/${role}-api/bin/Debug/net10.0/ChatBridge.Api.dll`)], {
    windowsHide: true, cwd: root, env: { ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: base(role),
      Auth__Issuer: `chatbridge-${role}`, Auth__Audience: `chatbridge-${role}-client`, Auth__SigningKey: keys[role],
      Auth__TokenSeconds: String(tokenSeconds), DemoUser__Username: credentials[role].username,
      DemoUser__Password: credentials[role].password, DemoUser__Name: role === 'web' ? 'Usuário Web' : 'Usuário Mobile',
      Interbackend__ServiceKey: serviceKey, Interbackend__Url: 'ws://localhost:5002/internal/ws',
      Cors__AllowedOrigin: 'http://localhost:3000',
    }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  processes.set(role, proc);
  // Consume output without writing credential-bearing runtime details to test reports.
  proc.stdout?.resume(); proc.stderr?.resume();
  await until(async () => {
    if (proc.exitCode !== null) throw new Error(`API ${role} encerrou com código ${proc.exitCode}.`);
    try { return (await fetch(base(role) + '/health')).ok; } catch { return false; }
  });
}
export async function stop(role: Role) {
  const proc = processes.get(role);
  if (!proc || proc.exitCode !== null) return;
  const exited = once(proc, 'exit'); proc.kill(); await exited;
  processes.delete(role);
}
export async function stopAll() { await stop('web'); await stop('mobile'); }
export async function connected() {
  await until(async () => (await (await fetch(base('web') + '/health')).json()).interbackend === 'connected');
}

type MobileEvent = { type: string; messageId: string; content?: string; senderId?: string; status?: string };
export async function mobileClient() {
  const response = await fetch(base('mobile') + '/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials.mobile) });
  if (!response.ok) throw new Error('Login mobile de teste falhou.');
  const { accessToken } = await response.json();
  const socket = new WebSocket(`${base('mobile').replace('http:', 'ws:')}/ws/chat?access_token=${encodeURIComponent(accessToken)}`);
  const messages: MobileEvent[] = [];
  socket.addEventListener('message', event => messages.push(JSON.parse(String(event.data))));
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('Conexão mobile de teste falhou.')), { once: true });
  });
  return {
    socket,
    async receive(content: string) {
      let found: MobileEvent | undefined;
      await until(() => { found = messages.find(m => m.type === 'chat.message' && m.content === content); return !!found; });
      return found!;
    },
    async send(content: string) {
      const messageId = randomUUID(); socket.send(JSON.stringify({ type: 'chat.send', messageId, content }));
      await until(() => messages.some(m => m.type === 'chat.ack' && m.messageId === messageId));
      return messageId;
    },
    close() { socket.close(); },
  };
}
