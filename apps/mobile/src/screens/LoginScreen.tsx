import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { Brand } from '../components/Brand';
import { Button } from '../components/Button';
import { login } from '../services/api';
import type { Session } from '../services/protocol';
import { colors } from '../theme/tokens';

export function LoginScreen({ onLogin, notice }: { onLogin: (session: Session) => void; notice: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function submit() {
    if (request.current) return;
    if (!username.trim() || !password) { setError('Informe usuário e senha.'); return; }
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLoading(true); setError('');
    try { const session = await login(username, password, controller.signal); setPassword(''); onLogin(session); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar. Tente novamente.'); }
    finally { clearTimeout(timeout); request.current = null; setLoading(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}><Brand /><Text style={styles.subtitle}>Converse em tempo real entre Web e Mobile</Text>
        <Text style={styles.title}>Entre na conversa</Text><Text style={styles.description}>Use sua conta Mobile para começar.</Text>
        {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
        <Text style={styles.label}>Usuário</Text><TextInput accessibilityLabel="Usuário" testID="username" style={styles.input}
          value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username"
          returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} editable={!loading} />
        <Text style={styles.label}>Senha</Text><TextInput ref={passwordInput} accessibilityLabel="Senha" testID="password" style={styles.input}
          value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false}
          autoComplete="current-password" returnKeyType="done" onSubmitEditing={submit} editable={!loading} />
        {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        <Button title={loading ? 'Entrando…' : 'Entrar'} onPress={submit} loading={loading} />
        <Text style={styles.footer}>Uma conversa simples. Uma conexão real.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 24 },
  subtitle: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginTop: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginTop: 30 },
  description: { color: colors.secondary, fontSize: 14, marginTop: 8, marginBottom: 12 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: colors.text, backgroundColor: colors.background, marginBottom: 8 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginVertical: 12 },
  notice: { color: colors.secondary, backgroundColor: colors.muted, padding: 12, borderRadius: 8, marginTop: 12 },
  footer: { color: colors.secondary, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
