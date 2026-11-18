import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import type { Session } from './src/services/protocol';
import { colors } from './src/theme/tokens';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const endSession = useCallback((message = '') => { setSession(null); setNotice(message); }, []);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar style="dark" />
    {session ? <ChatScreen session={session} onEnd={endSession} />
      : <LoginScreen notice={notice} onLogin={value => { setNotice(''); setSession(value); }} />}
  </SafeAreaView></SafeAreaProvider>;
}
