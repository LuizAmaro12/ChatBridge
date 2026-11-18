'use client';

import { useCallback, useState } from 'react';
import type { Session } from '@/lib/protocol';
import { LoginForm } from './auth/LoginForm';
import { Chat } from './chat/Chat';

export function TalkToMe() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const endSession = useCallback((message = '') => {
    setSession(null);
    setNotice(message);
  }, []);
  return session
    ? <Chat session={session} onEndSession={endSession} />
    : <LoginForm notice={notice} onLogin={value => { setNotice(''); setSession(value); }} />;
}
