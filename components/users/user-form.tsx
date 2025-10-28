import { api } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type RoleOpt = { id: number; name: string; status?: boolean };
type Props = {
  mode: 'create' | 'edit';
  userId?: number;
  onSuccess?: () => void;
};

export default function UserForm({ mode, userId, onSuccess }: Props) {
  // Campos
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // solo create / cambio opcional en edit
  const [status, setStatus] = useState(true);

  // ---- NUEVO: roles ----
  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Cargar roles (activos)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingRoles(true);
        const res = await api.get('/api/v1/admin/role', {
          params: { perPage: 200, 'filters[status]': true },
        });
        // Soporta respuesta con {data:[...]} o lista directa
        const list: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const opts: RoleOpt[] = list.map((r) => ({ id: r.id, name: r.name, status: r.status }));
        if (!alive) return;
        setRoles(opts);
        // set default solo si no hay selección aún
        if (opts.length && roleId == null) setRoleId(opts[0].id);
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.message ?? 'No se pudieron cargar los roles');
      } finally {
        setLoadingRoles(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Si EDIT, cargar datos del usuario
  useEffect(() => {
    if (mode !== 'edit' || !userId) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/api/v1/admin/user/${userId}`);
        if (!alive) return;
        setEmail(data.email ?? '');
        setStatus(!!data.status);
        // Si el backend devuelve roleId y/o role { name }, úsalo
        if (typeof data.roleId === 'number') setRoleId(data.roleId);
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo cargar el usuario');
      }
    })();
    return () => { alive = false; };
  }, [mode, userId]);

  const disableSubmit = useMemo(() => {
    if (!email) return true;
    if (mode === 'create' && password.length < 6) return true;
    if (!roleId) return true;
    return false;
  }, [email, password, mode, roleId]);

  const onSubmit = async () => {
    try {
      if (mode === 'create') {
        await api.post('/api/v1/admin/user/', {
          email,
          password,
          status,
          roleId: roleId,
        });
      } else {
        await api.put(`/api/v1/admin/user/${userId}`, {
          email,
          status,
          roleId,
          ...(password ? { password } : {}),
        });
      }
      onSuccess?.();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo guardar');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        {/* Email */}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="correo@dominio.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
        </View>

        {/* Password (solo crear / opcional en editar) */}
        <View style={styles.field}>
          <Text style={styles.label}>{mode === 'create' ? 'Contraseña' : 'Contraseña (opcional)'}</Text>
          <TextInput
            placeholder={mode === 'create' ? 'Mínimo 6 caracteres' : 'Dejar en blanco para no cambiar'}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
        </View>

        {/* Estado */}
        <View style={styles.field}>
          <Text style={styles.label}>Estado</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setStatus(true)}
              style={[styles.pill, status && styles.pillActive]}
            >
              <MaterialCommunityIcons name="check" size={16} color={status ? '#fff' : '#111827'} />
              <Text style={[styles.pillText, status && { color: '#fff' }]}>Activo</Text>
            </Pressable>
            <Pressable
              onPress={() => setStatus(false)}
              style={[styles.pill, !status && styles.pillDanger]}
            >
              <MaterialCommunityIcons name="close" size={16} color={!status ? '#fff' : '#111827'} />
              <Text style={[styles.pillText, !status && { color: '#fff' }]}>Inactivo</Text>
            </Pressable>
          </View>
        </View>

        {/* 👉 ROL (Picker) */}
        <View style={styles.field}>
          <Text style={styles.label}>Rol</Text>
          <View style={styles.pickerWrap}>
            {loadingRoles ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator />
                <Text style={{ color: '#6b7280', marginLeft: 8 }}>Cargando roles…</Text>
              </View>
            ) : (
              <Picker
                selectedValue={roleId ?? undefined}
                onValueChange={(v) => setRoleId(Number(v))}
                mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
              >
                {roles.map((r) => (
                  <Picker.Item key={r.id} label={r.name} value={r.id} />
                ))}
              </Picker>
            )}
          </View>
        </View>

        {/* Guardar */}
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            disabled={disableSubmit}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.btnPrimary,
              disableSubmit && { opacity: 0.5 },
              pressed && { opacity: 0.9 },
            ]}
          >
            <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', padding: 12, gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 13, color: '#374151', fontWeight: '600' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f3f4f6' },
  pillActive: { backgroundColor: '#10b981' },
  pillDanger: { backgroundColor: '#ef4444' },
  pillText: { color: '#111827', fontWeight: '700' },

  pickerWrap: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  pickerLoading: { flexDirection: 'row', alignItems: 'center', padding: 10 },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
});
