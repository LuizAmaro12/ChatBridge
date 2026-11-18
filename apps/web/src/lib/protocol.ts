export const MAX_CONTENT_LENGTH = 2000;
export type RemoteState = 'connecting' | 'connected' | 'disconnected';
export type ConnectionState = RemoteState | 'reconnecting';
export type DeliveryState = 'sending' | 'confirmed' | 'failed' | 'uncertain';
export type Session = { accessToken: string; expiresAt: string; user: { id: string; name: string } };
export type IncomingMessage = {
  type: 'chat.message'; messageId: string; roomId: 'general'; senderId: string;
  senderName: string; origin: 'web' | 'mobile'; content: string; timestamp: string;
};
export type ServerEvent = IncomingMessage
  | { type: 'chat.ack'; messageId: string; status: 'remote_received' }
  | { type: 'chat.error'; messageId: string | null; code: string; message: string }
  | { type: 'connection.status'; interbackend: RemoteState };
export type DisplayMessage = {
  messageId: string; origin: 'web' | 'mobile'; senderId: string; senderName: string;
  content: string; own: boolean; timestamp?: string; state?: DeliveryState; detail?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
  value !== '00000000-0000-0000-0000-000000000000';

export function parseServerEvent(raw: string): ServerEvent | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;
  if (value.type === 'connection.status' &&
    ['connected', 'connecting', 'disconnected'].includes(String(value.interbackend)))
    return value as ServerEvent;
  if (value.type === 'chat.error' && (value.messageId === null || isId(value.messageId)) &&
    typeof value.code === 'string' && typeof value.message === 'string') return value as ServerEvent;
  if (!isId(value.messageId)) return null;
  if (value.type === 'chat.ack' && value.status === 'remote_received') return value as ServerEvent;
  if (value.type === 'chat.message' && value.roomId === 'general' &&
    (value.origin === 'web' || value.origin === 'mobile') && typeof value.senderId === 'string' &&
    typeof value.senderName === 'string' && typeof value.content === 'string' &&
    value.content.length <= MAX_CONTENT_LENGTH && typeof value.timestamp === 'string') return value as ServerEvent;
  return null;
}

export function isSession(value: unknown): value is Session {
  return isRecord(value) && typeof value.accessToken === 'string' && value.accessToken.length > 0 &&
    typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)) &&
    isRecord(value.user) && typeof value.user.id === 'string' && typeof value.user.name === 'string';
}

export function classifyError(code: string): 'failed' | 'uncertain' {
  return ['remote_unavailable', 'invalid_content', 'content_too_long', 'invalid_message_id',
    'invalid_room', 'invalid_payload', 'invalid_json', 'unsupported_type', 'duplicate_conflict', 'busy']
    .includes(code) ? 'failed' : 'uncertain';
}

export const deliveryLabels: Record<DeliveryState, string> = {
  sending: 'Enviando…', confirmed: 'Recebida pelo serviço remoto',
  failed: 'Não foi possível enviar', uncertain: 'Não foi possível confirmar o recebimento',
};
