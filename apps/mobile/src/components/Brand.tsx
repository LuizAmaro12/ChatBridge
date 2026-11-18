import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
export function Brand() {
  return <View style={styles.row}><View accessibilityElementsHidden style={styles.icon}><View style={styles.bubble} /></View><Text style={styles.name}>TalkToMe</Text></View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 19, height: 15, borderWidth: 2, borderColor: 'white', borderRadius: 5, borderBottomLeftRadius: 0 },
  name: { color: colors.text, fontSize: 23, fontWeight: '700' },
});
