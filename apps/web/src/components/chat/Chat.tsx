import { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/use-chat';
import { deliveryLabels, MAX_CONTENT_LENGTH, type Session, type ConnectionState } from '@/lib/protocol';
import { Brand } from '../Brand';

const connectionLabels: Record<ConnectionState, string> = {
  connected: 'Conectado', connecting: 'Conectando…', reconnecting: 'Reconectando…', disconnected: 'Desconectado',
};
function displayTime(timestamp?: string) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

export function Chat({ session, onEndSession }: { session: Session; onEndSession: (message?: string) => void }) {
  const { state, client } = useChat(session, onEndSession);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const trimmedLength = state.draft.trim().length;
  const tooLong = trimmedLength > MAX_CONTENT_LENGTH;

  useEffect(() => {
    if (scroll.current && follow.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [state.messages]);

  function send() {
    follow.current = true;
    client.send();
    composer.current?.focus();
  }
  const connected = state.connection === 'connected';
  const remoteReady = state.remote === 'connected';
  const connectionNotice = !connected
    ? state.connection === 'disconnected'
      ? 'Sem conexão com o serviço. Você pode reconectar ou entrar novamente. Seu rascunho foi preservado.'
      : 'Conectando ao serviço. Seu rascunho permanece aqui enquanto a conexão é restabelecida.'
    : !remoteReady ? 'O serviço remoto está indisponível. Aguarde a reconexão para enviar; seu rascunho será preservado.' : '';

  return <div className="app-shell">
    <header className="app-header"><div className="app-header-inner">
      <Brand compact />
      <div className="account"><div className="account-name" title={session.user.name}>
        <span className="account-label">Você está conectado como</span>{session.user.name}
      </div><button type="button" className="secondary-button" onClick={() => { client.stop(); onEndSession(); }}>Sair</button></div>
    </div></header>
    <main className="chat-main">
      <section className="chat-panel" aria-labelledby="room-title">
        <header className="room-header">
          <div className="room-title"><span className="room-symbol" aria-hidden="true">#</span><div>
            <h1 id="room-title">Conversa geral</h1><p className="room-subtitle">Web e Mobile, na mesma conversa</p>
          </div></div>
          <div className="connections" role="status" aria-live="polite">
            <span className="connection" data-tone={connected ? 'success' : 'warning'}><span className="status-dot" />
              Você: {connectionLabels[state.connection]}</span>
            <span className="connection" data-tone={connected && remoteReady ? 'success' : 'warning'}><span className="status-dot" />
              Serviço remoto: {connected && remoteReady ? 'Disponível' : state.remote === 'connecting' ? 'Conectando…' : 'Indisponível'}</span>
          </div>
        </header>
        {connectionNotice && <div className="connection-notice" role="status">{connectionNotice}
          {state.connection === 'disconnected' && <button type="button" className="reconnect-button" onClick={client.reconnect}>Reconectar</button>}
        </div>}
        <div className="message-scroll" ref={scroll} onScroll={() => {
          const el = scroll.current;
          if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}>
          {state.messages.length === 0 ? <div className="empty-state">
            <div className="empty-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 6h20v15H14l-8 5V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M11 12h10M11 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
            <h2>Sua conversa começa aqui</h2><p>Envie uma mensagem para iniciar o chat.</p>
          </div> : <ol className="message-list" role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions text">
            {state.messages.map(message => {
              const time = displayTime(message.timestamp);
              return <li key={`${message.origin}:${message.messageId}`} className={`message-row${message.own ? ' own' : ''}`}>
                <span className="message-author">{message.own ? `${message.senderName} · Você` : message.senderName}</span>
                <div className="message-bubble"><p className="message-text">{message.content}</p>
                  {time && <div className="message-meta"><time className="message-time" dateTime={message.timestamp}>{time}</time></div>}
                </div>
                {message.state && <p className="message-state" data-state={message.state}>
                  {deliveryLabels[message.state]}{message.detail && <><br />{message.detail}</>}
                </p>}
              </li>;
            })}
          </ol>}
        </div>
        <form className="composer" onSubmit={event => { event.preventDefault(); send(); }}>
          {state.notice && <p className="alert composer-error" role="alert">{state.notice}</p>}
          <label className="composer-label" htmlFor="message">Sua mensagem</label>
          <div className="compose-row"><textarea id="message" name="message" ref={composer} rows={2}
            placeholder="Escreva uma mensagem…" value={state.draft} aria-invalid={tooLong}
            aria-describedby="composer-help" onChange={event => client.setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); if (trimmedLength > 0 && !tooLong) send();
              }
            }} />
            <button className="primary-button" type="submit" disabled={!trimmedLength || tooLong}>
              Enviar<svg className="send-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div id="composer-help" className="composer-help"><span className="keyboard-help">Enter para enviar · Shift+Enter para nova linha</span>
            <span className={tooLong ? 'limit-error' : ''} aria-live={tooLong ? 'polite' : 'off'}>
              {trimmedLength.toLocaleString('pt-BR')} / 2.000{tooLong ? ' · Limite excedido' : ''}</span></div>
        </form>
      </section>
      <p className="chat-footnote">A confirmação é do serviço remoto, não de entrega ou leitura. A conversa fica apenas nesta sessão.</p>
    </main>
  </div>;
}
