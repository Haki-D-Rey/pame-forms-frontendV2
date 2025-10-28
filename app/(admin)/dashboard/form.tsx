import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, Text, View } from 'react-native';

export default function FormularioScreen() {
  const text = useThemeColor({}, 'text');
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: text }]}>Dashboard / Formulario</Text>
      <Text style={{ color: text, opacity: 0.8 }}>Crea/edita formularios aquí.</Text>
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { flex: 1 }, title: { fontSize: 18, fontWeight: '800', marginBottom: 6 } });
