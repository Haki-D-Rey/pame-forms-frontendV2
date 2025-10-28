import { api as defaultApi } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AxiosInstance } from 'axios';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export type PasswordFlowUser = { id: number; email: string };

type Options = {
  axios?: AxiosInstance;
  verifyEndpoint?: string;                     // POST { password }
  changeEndpoint?: (userId: number) => string; // POST/PUT { password }
  onSuccess?: () => void;
};

export function useUserPasswordFlow({
  axios = defaultApi,
  verifyEndpoint = '/api/v1/admin/user/verify-password',
  changeEndpoint = (id) => `/api/v1/admin/user/${id}/password`,
  onSuccess,
}: Options = {}) {
  const [user, setUser] = useState<PasswordFlowUser | null>(null);

  // Modal 1: verificar
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [verifyPass, setVerifyPass] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showVerifyPass, setShowVerifyPass] = useState(false);

  // Modal 2: cambiar
  const [changeVisible, setChangeVisible] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [changing, setChanging] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showNewPass2, setShowNewPass2] = useState(false);

  const openFor = (u: PasswordFlowUser) => {
    setUser(u);
    setVerifyPass('');
    setNewPass('');
    setNewPass2('');
    setVerifying(false);
    setChanging(false);
    setShowVerifyPass(false);
    setShowNewPass(false);
    setShowNewPass2(false);
    setVerifyVisible(true);
    setChangeVisible(false);
  };

  const closeAll = () => {
    setVerifyVisible(false);
    setChangeVisible(false);
    setUser(null);
    setVerifyPass('');
    setNewPass('');
    setNewPass2('');
    setVerifying(false);
    setChanging(false);
    setShowVerifyPass(false);
    setShowNewPass(false);
    setShowNewPass2(false);
  };

  const handleVerify = async () => {
    if (!verifyPass) {
      Alert.alert('Validación', 'Ingresa tu contraseña.');
      return;
    }
    setVerifying(true);
    try {
      await axios.post(verifyEndpoint, { password: verifyPass });
      setVerifyVisible(false);
      setChangeVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Contraseña inválida');
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = async () => {
    if (!user) return;
    if (!newPass || newPass.length < 6) {
      Alert.alert('Validación', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPass !== newPass2) {
      Alert.alert('Validación', 'Las contraseñas no coinciden.');
      return;
    }
    setChanging(true);
    try {
      await axios.put(changeEndpoint(user.id), { password: newPass });
      Alert.alert('Éxito', 'Contraseña actualizada.');
      closeAll();
      onSuccess?.();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setChanging(false);
    }
  };

  // Devuelve JSX (no componente) para no perder foco
  const modals = useMemo(
    () => (
      <>
        {/* ------------- MODAL: VERIFICAR ------------- */}
        <Modal
          visible={verifyVisible}
          transparent
          animationType="fade"
          onRequestClose={closeAll}
          presentationStyle="overFullScreen"
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.backdrop}>
              <View style={styles.card}>
                {/* Header */}
                <View style={[styles.headerRow, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <View style={[styles.iconBadge, { backgroundColor: '#fee2e2' }]}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#b91c1c" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.title, { color: '#991b1b' }]}>Verificación requerida</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      Para modificar credenciales de {user ? user.email : 'el usuario'}
                    </Text>
                  </View>
                </View>

                {/* Campo contraseña + ojo */}
                <Text style={styles.label}>Tu contraseña</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder="Ingresa tu contraseña"
                    secureTextEntry={!showVerifyPass}
                    value={verifyPass}
                    onChangeText={setVerifyPass}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    // autoFocus
                  />
                  <Pressable onPress={() => setShowVerifyPass((s) => !s)} style={styles.eyeBtn} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showVerifyPass ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6b7280"
                    />
                  </Pressable>
                </View>
                <Text style={styles.hint}>Solo se utiliza para confirmar tu identidad.</Text>

                {/* Acciones */}
                <View style={styles.actionsRow}>
                  <Pressable onPress={closeAll} style={styles.btnGhost}>
                    <Text style={styles.btnGhostText}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={handleVerify} disabled={verifying} style={styles.btnPrimary}>
                    {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Verificar</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ------------- MODAL: CAMBIAR ------------- */}
        <Modal
          visible={changeVisible}
          transparent
          animationType="fade"
          onRequestClose={closeAll}
          presentationStyle="overFullScreen"
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.backdrop}>
              <View style={styles.card}>
                {/* Header */}
                <View style={[styles.headerRow, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <View style={[styles.iconBadge, { backgroundColor: '#dbeafe' }]}>
                    <MaterialCommunityIcons name="key-change" size={20} color="#1d4ed8" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.title, { color: '#1e40af' }]}>Cambiar contraseña</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      Usuario: {user ? user.email : '-'}
                    </Text>
                  </View>
                </View>

                {/* Nueva contraseña */}
                <Text style={styles.label}>Nueva contraseña</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder="Mínimo 6 caracteres"
                    secureTextEntry={!showNewPass}
                    value={newPass}
                    onChangeText={setNewPass}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => setShowNewPass((s) => !s)} style={styles.eyeBtn} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showNewPass ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6b7280"
                    />
                  </Pressable>
                </View>

                {/* Confirmación */}
                <Text style={styles.label}>Confirmar contraseña</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    placeholder="Repite la nueva contraseña"
                    secureTextEntry={!showNewPass2}
                    value={newPass2}
                    onChangeText={setNewPass2}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => setShowNewPass2((s) => !s)} style={styles.eyeBtn} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showNewPass2 ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6b7280"
                    />
                  </Pressable>
                </View>

                <Text style={styles.hint}>Asegúrate de que ambas contraseñas coincidan.</Text>

                {/* Acciones */}
                <View style={styles.actionsRowBetween}>
                  <Pressable
                    onPress={() => {
                      setChangeVisible(false);
                      setVerifyVisible(true);
                    }}
                    style={styles.btnGhost}
                  >
                    <Text style={styles.btnGhostText}>Atrás</Text>
                  </Pressable>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={closeAll} style={styles.btnGhost}>
                      <Text style={styles.btnGhostText}>Cancelar</Text>
                    </Pressable>
                    <Pressable onPress={handleChange} disabled={changing} style={styles.btnPrimary}>
                      {changing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnPrimaryText}>Guardar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </>
    ),
    [
      verifyVisible,
      changeVisible,
      verifyPass,
      newPass,
      newPass2,
      verifying,
      changing,
      user,
      showVerifyPass,
      showNewPass,
      showNewPass2,
    ]
  );

  return { openFor, modals };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'center', padding: 24 },

  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },

  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, color: '#475569' },

  label: { fontSize: 12, color: '#374151', marginTop: 4, marginBottom: 4, fontWeight: '600' },

  inputWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 6 },
  eyeBtn: { padding: 6, borderRadius: 8 },

  hint: { fontSize: 12, color: '#6b7280' },

  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  actionsRowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' },

  btnGhost: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6' },
  btnGhostText: { color: '#111827', fontWeight: '600' },

  btnPrimary: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
