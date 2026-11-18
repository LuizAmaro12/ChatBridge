import { useEffect, useState, useSyncExternalStore } from 'react';
import { ChatClient } from '@/lib/chat-client';
import type { Session } from '@/lib/protocol';

export function useChat(session: Session, onEndSession: (message?: string) => void) {
  const [client] = useState(() => new ChatClient());
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot);
  useEffect(() => {
    client.start(session, onEndSession);
    return () => client.stop();
  }, [client, session, onEndSession]);
  return { state, client };
}
