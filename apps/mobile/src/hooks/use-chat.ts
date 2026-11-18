import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { ChatClient } from '../services/chat-client';
import { createNativeSocket } from '../services/native-socket';
import type { Session } from '../services/protocol';
export function useChat(session: Session, onEnd: (message: string) => void) {
  const [client] = useState(() => new ChatClient(randomUUID, createNativeSocket));
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot);
  useEffect(() => {
    client.start(session, onEnd);
    client.setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => client.setActive(state === 'active'));
    return () => { listener.remove(); client.stop(); };
  }, [client, session, onEnd]);
  return { client, snapshot };
}
