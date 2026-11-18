import { ActivityIndicator, Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
export function Button({ title, onPress, disabled = false, loading = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary,
      pressed && { backgroundColor: secondary ? colors.muted : colors.pressed }, (disabled || loading) && { opacity: 0.55 }]}>
    {loading && <ActivityIndicator color="white" size="small" />}<Text style={[styles.text, secondary && { color: colors.primary }]}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  text: { color: 'white', fontSize: 16, fontWeight: '600' },
});
