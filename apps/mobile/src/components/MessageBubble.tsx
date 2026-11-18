import { Text, View, StyleSheet } from 'react-native';
import { deliveryLabels, type DisplayMessage } from '../services/protocol';
import { colors } from '../theme/tokens';
export function MessageBubble({ message }: { message: DisplayMessage }) {
  const time = message.timestamp && Number.isFinite(Date.parse(message.timestamp))
    ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  return <View style={[styles.row, message.own && { alignItems: 'flex-end' }]}>
    <View style={[styles.bubble, message.own && styles.own]}>
      <Text style={[styles.author, message.own && styles.white]}>{message.senderName}</Text>
      <Text selectable style={[styles.content, message.own && styles.white]}>{message.content}</Text>
      {!!time && <Text style={[styles.time, message.own && styles.white]}>{time}</Text>}
    </View>
    {!!message.state && <Text accessibilityLiveRegion="polite" style={[styles.status,
      message.state === 'failed' && { color: colors.danger }]}>{deliveryLabels[message.state]}</Text>}
    {!!message.detail && <Text style={styles.detail}>{message.detail}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', marginVertical: 8 },
  bubble: { maxWidth: '88%', padding: 14, backgroundColor: colors.muted, borderRadius: 18, borderBottomLeftRadius: 4 },
  own: { backgroundColor: colors.primary, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  author: { fontSize: 12, fontWeight: '700', color: colors.secondary, marginBottom: 6 },
  content: { fontSize: 16, lineHeight: 23, color: colors.text },
  white: { color: 'white' },
  time: { fontSize: 12, color: colors.secondary, marginTop: 8, alignSelf: 'flex-end' },
  status: { fontSize: 12, color: colors.secondary, marginTop: 5, maxWidth: '90%' },
  detail: { color: colors.secondary, fontSize: 12, lineHeight: 17, maxWidth: '90%', marginTop: 3 },
});
