import { isSession, type Session } from './protocol';

export function apiUrl(path: string): URL {
  const base = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('Configuração do serviço inválida.');
  return new URL(path, base);
}

export async function login(username: string, password: string, signal: AbortSignal): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/auth/login'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
      cache: 'no-store', credentials: 'omit', signal,
    });
  } catch {
    throw new Error('Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.');
  }
  if (response.status === 401) throw new Error('Não foi possível entrar. Confira suas credenciais.');
  if (!response.ok) throw new Error('Não foi possível entrar agora. Tente novamente.');
  const body: unknown = await response.json().catch(() => null);
  if (!isSession(body) || Date.parse(body.expiresAt) <= Date.now())
    throw new Error('O serviço retornou uma sessão inválida. Tente entrar novamente.');
  return body;
}

export function chatUrl(token: string): string {
  const url = apiUrl('/ws/chat');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('access_token', token);
  return url.toString();
}
