import { useRef, type ComponentRef } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Brand } from '../components/Brand';
import { Button } from '../components/Button';
import { MessageBubble } from '../components/MessageBubble';
import { useChat } from '../hooks/use-chat';
import { MAX_CONTENT_LENGTH, type Session } from '../services/protocol';
import { colors } from '../theme/tokens';

const connectionLabels = { connecting: 'Conectando…', connected: 'Conectado', reconnecting: 'Reconectando…', disconnected: 'Desconectado' };
export function ChatScreen({ session, onEnd }: { session: Session; onEnd: (message?: string) => void }) {
  const { client, snapshot } = useChat(session, onEnd);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const nearEnd = useRef(true);
  const userScrolling = useRef(false);
  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!userScrolling.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearEnd.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 90;
  }
  const length = snapshot.draft.trim().length;
  const exceeded = length > MAX_CONTENT_LENGTH;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.header}><View style={{ flex: 1 }}><Brand /><Text style={styles.user}>{session.user.name}</Text></View>
      <Button secondary title="Sair" onPress={() => { client.stop(); onEnd(); }} /></View>
    <View style={styles.room}><Text style={styles.title}>Conversa geral</Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        <Text style={{ color: snapshot.connection === 'connected' ? colors.success : colors.warning }}>● </Text>
        {connectionLabels[snapshot.connection]}
      </Text>
      <Text style={styles.remote}>{snapshot.remote === 'connected' ? 'Canal entre serviços conectado' : 'Canal entre serviços indisponível'}</Text>
      {snapshot.connection === 'disconnected' && <Button secondary title="Reconectar" onPress={client.reconnect} />}
    </View>
    <ScrollView ref={list} testID="message-list"
      contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={() => { userScrolling.current = true; }}
      onScrollEndDrag={event => { trackScroll(event); userScrolling.current = false; }}
      onMomentumScrollBegin={() => { userScrolling.current = true; }}
      onMomentumScrollEnd={event => { trackScroll(event); userScrolling.current = false; }}
      onScroll={trackScroll} scrollEventThrottle={100}
      onContentSizeChange={() => { if (nearEnd.current) list.current?.scrollToEnd({ animated: false }); }}
      onLayout={() => { if (nearEnd.current) list.current?.scrollToEnd({ animated: false }); }}>
      {snapshot.messages.length ? snapshot.messages.map(message => <MessageBubble key={`${message.origin}:${message.messageId}`} message={message} />)
        : <View style={styles.empty}><Text style={styles.title}>Sua conversa começa aqui</Text><Text style={styles.emptyText}>Envie uma mensagem para iniciar o chat.</Text></View>}
    </ScrollView>
    <View style={styles.composer}>
      {!!snapshot.notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{snapshot.notice}</Text>}
      <View style={styles.inputRow}><TextInput accessibilityLabel="Mensagem" testID="message-input"
        placeholder="Escreva uma mensagem…" placeholderTextColor={colors.secondary} multiline
        style={styles.input} value={snapshot.draft} onChangeText={client.setDraft} />
        <Button title="Enviar" disabled={!length || exceeded} onPress={() => { if (client.send()) { nearEnd.current = true; list.current?.scrollToEnd({ animated: false }); } }} /></View>
      <Text style={[styles.counter, exceeded && { color: colors.danger }]}>{exceeded ? 'Limite excedido · ' : ''}{length} / {MAX_CONTENT_LENGTH}</Text>
      <Text style={styles.footnote}>Confirmação do serviço não significa entrega ou leitura. Sem histórico salvo.</Text>
    </View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  user: { color: colors.secondary, fontSize: 13, marginTop: 8 },
  room: { paddingHorizontal: 20, paddingVertical: 12, gap: 5, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  status: { fontSize: 14, color: colors.secondary },
  remote: { fontSize: 12, color: colors.secondary },
  messages: { paddingHorizontal: 20, paddingVertical: 12, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.secondary, textAlign: 'center', fontSize: 14, lineHeight: 22, marginTop: 8 },
  composer: { borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, fontSize: 16, textAlignVertical: 'top' },
  counter: { textAlign: 'right', color: colors.secondary, fontSize: 12, marginTop: 5 },
  footnote: { color: colors.secondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, marginBottom: 8 },
});
