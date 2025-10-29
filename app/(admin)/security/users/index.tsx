import { ThemedText } from '@/components/themed-text';
import { ServerList, type Column, type ServerListHandle } from '@/components/ui/server-list';
import { useUserPasswordFlow } from '@/components/users/user-password-flow';
import UserRowActions from '@/components/users/user-row-actions';
import { useThemeColor } from '@/hooks/use-theme-color';
import { api } from '@/lib/api';
import { RoleSafeDTO } from '@/types/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

type User = {
  id: number;
  email: string;
  role: RoleSafeDTO;
  status: boolean;
  createdAt: string;
  updatedAt: string;
};

const apifecth = api;

function formatDateTime(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function UserScreen() {
  const ref = useRef<ServerListHandle>(null);
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [listReady, setListReady] = useState(false);
  const router = useRouter();

  // ===== Tokens de tema =====
  const text    = useThemeColor({}, 'text');
  const tint    = useThemeColor({}, 'tint');
  const border  = useThemeColor({}, 'border');
  const muted   = useThemeColor({}, 'muted');
  const fieldBg = useThemeColor({}, 'fieldBg');
  const surface = useThemeColor({}, 'surface');

  const scheme  = useColorScheme();
  const isDark  = scheme === 'dark';
  const ripple  = (c: string) => (Platform.OS === 'android' ? { android_ripple: { color: c } } : {});

  // colores semánticos mínimos
  const success = '#16a34a';
  const danger  = '#ef4444';

  const { openFor, modals } = useUserPasswordFlow({
    onSuccess: () => ref.current?.reload(),
  });
  const PasswordModals = modals;

  useFocusEffect(useCallback(() => { ref.current?.reload(); }, []));

  const columns: Column<User>[] = useMemo(() => ([
    {
      key: 'id', header: 'ID', sortable: true, width: 80, align: 'left',
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="tag-outline" size={18} color={muted} />
          <Text style={{ color: text, fontSize: 14 }}>{r.id}</Text>
        </View>
      ),
    },
    {
      key: 'email', header: 'Email', sortable: true, filter: { type: 'text' },
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          <MaterialCommunityIcons name="email-outline" size={18} color={muted} />
          <Text style={{ color: text, fontSize: 14, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
            {r.email}
          </Text>
        </View>
      ),
    },
    {
      key: 'role', header: 'Nombre del Rol', sortable: false, align: 'left', filter: { type: 'text' },
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="shield-account-outline" size={18} color={muted} />
          <Text style={{ color: text, fontSize: 14 }}>{r.role.name}</Text>
        </View>
      ),
    },
    {
      key: 'status', header: 'Activo', sortable: true, filter: { type: 'boolean' }, align: 'center',
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 }}>
          <MaterialCommunityIcons
            name={r.status ? 'account-check' : 'account-off'}
            size={18}
            color={r.status ? success : danger}
          />
          <Text style={{ color: text, fontSize: 14 }}>{r.status ? 'Activo' : 'Inactivo'}</Text>
        </View>
      ),
    },
    {
      key: 'createdAt', header: 'Fecha Creación', sortable: true, filter: { type: 'range-date' }, width: 200,
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="calendar-clock" size={18} color={muted} />
          <Text style={{ color: text, fontSize: 14 }}>{formatDateTime(r.createdAt)}</Text>
        </View>
      ),
    },
    {
      key: 'updatedAt', header: 'Fecha Modificación', sortable: true, filter: { type: 'range-date' }, width: 200,
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="calendar-clock" size={18} color={muted} />
          <Text style={{ color: text, fontSize: 14 }}>{formatDateTime(r.updatedAt)}</Text>
        </View>
      ),
    },
  ]), [text, muted, success, danger]);

  const handleDelete = (row: User) => {
    Alert.alert(
      'Eliminar usuario',
      `¿Seguro que deseas eliminar a "${row.email}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(row.id);
              await apifecth.delete(`/api/v1/admin/user/${row.id}`);
              ref.current?.reload();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'No se pudo eliminar');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  // ---- Acciones masivas (activar/desactivar) ----
  const handleBulk = async (status: boolean) => {
    const ids = Array.from(selected).map((v) => Number(v)).filter(Boolean);
    if (ids.length === 0) return;

    try {
      await Promise.all(ids.map((id) => apifecth.patch(`/api/v1/admin/user/${id}`, { status })));
      setSelected(new Set());
      ref.current?.reload();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'No se pudo aplicar la acción');
    }
  };

  const selectedCount = selected.size;

  const headerCardShadow = Platform.select({
    ios:   { shadowColor: '#000', shadowOpacity: isDark ? 0.25 : 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: isDark ? 8 : 4 },
    default: { } as any,
  });

  const ghostBorder = isDark ? 'rgba(255,255,255,0.14)' : border;
  const ghostBg     = isDark ? 'rgba(255,255,255,0.04)' : 'transparent';
  const rippleC     = isDark ? '#FFFFFF22' : '#00000022';

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: surface }}>
      {/* Header */}
      <View style={{ width: '100%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
        <View
          style={[
            {
              backgroundColor: surface,
              borderColor: border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: 14,
              padding: 12,
            },
            headerCardShadow,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="account-group-outline" size={18} color={text} />
                <ThemedText type="title">Usuarios</ThemedText>
              </View>
              <Text style={{ color: muted, marginTop: 2 }} numberOfLines={1}>
                Gestiona cuentas, estados y credenciales.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>

              {/* Primario (Nuevo) */}
              <Pressable
                onPress={() => router.push('/(admin)/security/users/new' as const)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: tint,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                  },
                  pressed && { opacity: 0.92 },
                ]}
                accessibilityRole="button"
                {...ripple(rippleC)}
              >
                <MaterialCommunityIcons name="account-plus-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700' }}>Nuevo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <ServerList<User>
        ref={ref}
        axios={apifecth}
        endpoint="/api/v1/admin/user"
        layout="auto"
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedKeys={selected}
        onSelectionChange={setSelected}
        renderBulkActions={({ selectedCount: scFromList, clearSelection }) => {
          const sc = scFromList ?? selectedCount;
          const disabled = !sc;
          const basePill = { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 } as const;

          return (
            <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="select-multiple" size={18} color={text} />
              <Text style={{ color: text }}>
                Seleccionados: <Text style={{ fontWeight: '700' }}>{sc}</Text>
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                {/* Activar */}
                <Pressable
                  disabled={disabled}
                  onPress={() => handleBulk(true)}
                  style={({ pressed }) => [
                    basePill,
                    {
                      backgroundColor: disabled ? fieldBg : (isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7'),
                      borderWidth: 1,
                      borderColor: disabled ? border : (isDark ? 'rgba(134,239,172,0.5)' : '#86efac'),
                    },
                    pressed && !disabled && { opacity: 0.9 },
                  ]}
                  {...ripple(rippleC)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="account-check-outline" size={16} color={disabled ? muted : (isDark ? '#22c55e' : '#166534')} />
                    <Text style={{ color: disabled ? muted : (isDark ? '#22c55e' : '#166534'), fontWeight: '700' }}>Activar</Text>
                  </View>
                </Pressable>

                {/* Desactivar */}
                <Pressable
                  disabled={disabled}
                  onPress={() => handleBulk(false)}
                  style={({ pressed }) => [
                    basePill,
                    {
                      backgroundColor: disabled ? fieldBg : (isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2'),
                      borderWidth: 1,
                      borderColor: disabled ? border : (isDark ? 'rgba(254,202,202,0.5)' : '#fecaca'),
                    },
                    pressed && !disabled && { opacity: 0.9 },
                  ]}
                  {...ripple(rippleC)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="account-off-outline" size={16} color={disabled ? muted : (isDark ? '#ef4444' : '#991b1b')} />
                    <Text style={{ color: disabled ? muted : (isDark ? '#ef4444' : '#991b1b'), fontWeight: '700' }}>Desactivar</Text>
                  </View>
                </Pressable>

                {!!sc && (
                  <Pressable
                    onPress={clearSelection}
                    style={({ pressed }) => [
                      basePill,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : surface,
                        borderWidth: 1,
                        borderColor: ghostBorder,
                      },
                      pressed && { opacity: 0.92 },
                    ]}
                    {...ripple(rippleC)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons name="selection-off" size={16} color={text} />
                      <Text style={{ color: text, fontWeight: '700' }}>Limpiar</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        renderRowActions={(row) => (
          <UserRowActions
            user={row}
            deleting={deletingId === row.id}
            onEdit={() => router.push({ pathname: '/(admin)/security/users/[id]', params: { id: String(row.id) } })}
            onDelete={() => handleDelete(row)}
            onChangePassword={() => openFor({ id: row.id, email: row.email })}
          />
        )}
        onQueryChange={(q) => {
          if (!listReady) setListReady(true);
          console.log('Query cambió', q);
        }}
      />

      {/* Modales globales del flujo de contraseña */}
      {PasswordModals}
    </View>
  );
}
