import { chatUrl } from './api';
import { classifyError, MAX_CONTENT_LENGTH, parseServerEvent, type Session,
  type ConnectionState, type RemoteState, type DisplayMessage } from './protocol';

export type ChatSnapshot = {
  connection: ConnectionState; remote: RemoteState; messages: DisplayMessage[];
  draft: string; notice: string;
};
const initialSnapshot: ChatSnapshot = {
  connection: 'connecting', remote: 'disconnected', messages: [], draft: '', notice: '',
};
const uncertainText = 'A mensagem pode ter chegado. Ela não será reenviada automaticamente.';

// Owns one socket and its timers. No persistence, replay, or backend identity construction.
export class ChatClient {
  private snapshot: ChatSnapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private socket: WebSocket | null = null;
  private session: Session | null = null;
  private onSessionEnd: ((message: string) => void) | null = null;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private stableTimer?: ReturnType<typeof setTimeout>;
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  private stopped = true;
  private suspended = false;
  private attempts = 0;
  private failedHandshakes = 0;
  constructor(private createId: () => string,
    private createSocket: (url: string) => WebSocket = url => new WebSocket(url)) {}

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initialSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(change: Partial<ChatSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach(listener => listener());
  }
  setDraft = (draft: string) => this.update({ draft, notice: '' });

  start(session: Session, onSessionEnd: (message: string) => void) {
    this.stop();
    this.stopped = false;
    this.suspended = false;
    this.update({ ...initialSnapshot, messages: [] });
    this.session = session;
    this.onSessionEnd = onSessionEnd;
    this.attempts = 0;
    this.failedHandshakes = 0;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining <= 0) { this.expire(); return; }
    this.expiryTimer = setTimeout(() => this.expire(), remaining);
    // Defer one turn so React Strict Mode's setup/cleanup cycle cannot open a redundant socket.
    this.retryTimer = setTimeout(() => this.connect(), 0);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer); clearTimeout(this.expiryTimer);
    clearTimeout(this.connectTimer); clearTimeout(this.stableTimer);
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close(1000, 'Session closed');
    }
    this.session = null;
    this.onSessionEnd = null;
    this.snapshot = { ...initialSnapshot, messages: [] };
  }

  // Android can freeze timers/network in background. Close deliberately; never replay.
  setActive = (active: boolean) => {
    if (this.stopped || this.suspended === !active) return;
    this.suspended = !active;
    if (active) { this.reconnect(); return; }
    clearTimeout(this.retryTimer); clearTimeout(this.connectTimer); clearTimeout(this.stableTimer);
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close(1000, 'App background');
    }
    this.markPendingUncertain();
    this.update({ connection: 'disconnected', remote: 'disconnected' });
  };

  private expire(message = 'Sua sessão expirou. Entre novamente.') {
    const end = this.onSessionEnd;
    this.stop();
    end?.(message);
  }

  reconnect = () => {
    if (this.stopped || this.suspended || this.socket) return;
    clearTimeout(this.retryTimer);
    this.failedHandshakes = 0;
    this.attempts = 0;
    this.connect();
  };

  private connect() {
    if (this.stopped || this.suspended || !this.session || this.socket) return;
    if (Date.parse(this.session.expiresAt) <= Date.now()) { this.expire(); return; }
    this.update({ connection: this.attempts ? 'reconnecting' : 'connecting', remote: 'disconnected' });
    let socket: WebSocket;
    try { socket = this.createSocket(chatUrl(this.session.accessToken)); }
    catch { this.update({ connection: 'disconnected', notice: 'Não foi possível abrir a conexão com o serviço.' }); return; }
    this.socket = socket;
    let opened = false;
    this.connectTimer = setTimeout(() => socket.close(), 10000);
    socket.onopen = () => {
      if (this.stopped || this.socket !== socket) return;
      opened = true;
      clearTimeout(this.connectTimer);
      this.failedHandshakes = 0;
      this.update({ connection: 'connected', notice: '' });
      this.stableTimer = setTimeout(() => { this.attempts = 0; }, 30000);
    };
    socket.onmessage = event => {
      if (this.stopped || this.socket !== socket || typeof event.data !== 'string') return;
      const message = parseServerEvent(event.data);
      if (!message) { this.update({ notice: 'Foi recebida uma resposta inválida do serviço.' }); return; }
      if (message.type === 'connection.status') { this.update({ remote: message.interbackend }); return; }
      if (message.type === 'chat.message') {
        if (this.snapshot.messages.some(m => m.messageId === message.messageId && m.origin === message.origin)) return;
        this.update({ messages: [...this.snapshot.messages, { ...message, own: false }] });
        return;
      }
      if (message.type === 'chat.error' && message.code === 'session_expired') { this.expire(); return; }
      if (message.messageId === null) {
        this.update({ notice: 'O serviço não conseguiu processar a mensagem. Verifique a conexão.' });
        return;
      }
      if (!this.pending.has(message.messageId)) return; // Unknown/late responses cannot overwrite terminal state.
      clearTimeout(this.pending.get(message.messageId));
      this.pending.delete(message.messageId);
      if (message.type === 'chat.ack') {
        this.updateMessage(message.messageId, { state: 'confirmed', detail: undefined });
      } else {
        const state = classifyError(message.code);
        this.updateMessage(message.messageId, { state,
          detail: state === 'uncertain' ? uncertainText : this.failureText(message.code) });
        if (state === 'failed' && !this.snapshot.draft) {
          const original = this.snapshot.messages.find(m => m.own && m.messageId === message.messageId);
          if (original) this.update({ draft: original.content });
        }
      }
    };
    // Transport errors intentionally do not expose HTTP details or token-bearing URLs.
    socket.onerror = () => {};
    socket.onclose = event => {
      if (this.stopped || this.socket !== socket) return;
      this.socket = null;
      clearTimeout(this.connectTimer); clearTimeout(this.stableTimer);
      this.markPendingUncertain();
      this.update({ connection: 'disconnected', remote: 'disconnected' });
      if (event.code === 1008) {
        this.expire('Sua sessão foi encerrada pelo serviço. Entre novamente.'); return;
      }
      if (!opened) this.failedHandshakes++;
      if (this.failedHandshakes >= 3) {
        this.update({ notice: 'Não foi possível estabelecer a conexão. Tente reconectar ou saia e entre novamente.' });
        return;
      }
      const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5));
      this.update({ connection: 'reconnecting' });
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private failureText(code: string): string {
    if (code === 'remote_unavailable') return 'O serviço remoto está indisponível. Seu texto foi preservado quando possível.';
    if (code === 'busy') return 'O serviço atingiu um limite temporário. Tente mais tarde.';
    if (code === 'content_too_long') return 'Use no máximo 2000 caracteres.';
    return 'A mensagem foi rejeitada pelo serviço. Verifique o texto antes de tentar novamente.';
  }
  private updateMessage(id: string, change: Partial<DisplayMessage>) {
    this.update({ messages: this.snapshot.messages.map(m => m.own && m.messageId === id ? { ...m, ...change } : m) });
  }
  private markPendingUncertain() {
    for (const [id, timer] of this.pending) {
      clearTimeout(timer);
      this.updateMessage(id, { state: 'uncertain', detail: uncertainText });
    }
    this.pending.clear();
  }

  send = (): boolean => {
    const content = this.snapshot.draft.trim();
    if (!content || content.length > MAX_CONTENT_LENGTH) return false;
    if (this.stopped || !this.session || Date.parse(this.session.expiresAt) <= Date.now()) { this.expire(); return false; }
    if (!this.socket || this.socket.readyState !== 1 || this.snapshot.remote !== 'connected') {
      this.update({ notice: 'Não foi possível enviar: a conexão está indisponível. Seu texto foi preservado.' });
      return false;
    }
    const messageId = this.createId();
    const own: DisplayMessage = { messageId, origin: 'mobile', senderId: this.session.user.id,
      senderName: this.session.user.name, own: true, content, state: 'sending' };
    // No fabricated server timestamp: own messages have status only until protocol supplies a time.
    this.update({ messages: [...this.snapshot.messages, own], notice: '' });
    this.pending.set(messageId, setTimeout(() => {
      this.pending.delete(messageId);
      this.updateMessage(messageId, { state: 'uncertain', detail: uncertainText });
    }, 12000));
    try {
      this.socket.send(JSON.stringify({ type: 'chat.send', messageId, content }));
      this.update({ draft: '' });
      return true;
    } catch {
      clearTimeout(this.pending.get(messageId)); this.pending.delete(messageId);
      this.updateMessage(messageId, { state: 'failed', detail: 'Não foi possível iniciar o envio. Seu texto foi preservado.' });
      return false;
    }
  };
}
