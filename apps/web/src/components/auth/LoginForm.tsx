import { useEffect, useRef, useState, type FormEvent } from 'react';
import { login } from '@/lib/api';
import type { Session } from '@/lib/protocol';
import { Brand } from '../Brand';

export function LoginForm({ notice, onLogin }: { notice: string; onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.current || !username.trim() || !password) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setError(''); setLoading(true);
    try {
      const session = await login(username, password, controller.signal);
      if (!controller.signal.aborted) {
        setPassword('');
        onLogin(session);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      clearTimeout(timeout);
      request.current = null;
      setLoading(false);
    }
  }

  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <Brand />
      <div className="login-heading">
        <h1 id="login-title">Uma boa conversa começa aqui.</h1>
        <p>Converse em tempo real entre Web e Mobile</p>
      </div>
      <form className="login-form" onSubmit={submit} aria-busy={loading}>
        <div className="field"><label htmlFor="username">Usuário</label>
          <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder="Seu usuário" required maxLength={64} value={username} disabled={loading}
            onChange={event => setUsername(event.target.value)} /></div>
        <div className="field"><label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password"
            placeholder="Sua senha" required maxLength={256} value={password} disabled={loading}
            onChange={event => setPassword(event.target.value)} /></div>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}{loading ? 'Entrando…' : 'Entrar'}
          {!loading && <span aria-hidden="true">→</span>}
        </button>
        {error && <p className="alert" role="alert">{error}</p>}
      </form>
      {notice && <p className="alert session-notice" role="status">{notice}</p>}
    </section>
    <p className="login-footer">Uma conversa. Duas plataformas. Em tempo real.</p>
  </main>;
}
