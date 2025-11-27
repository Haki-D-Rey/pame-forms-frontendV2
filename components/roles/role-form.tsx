import PermissionsPicker, { PermissionOption } from '@/components/ui/permissions-list';
import { useThemeColor } from '@/hooks/use-theme-color';
import { api } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View
} from 'react-native';

type Props = {
    mode: 'edit' | 'create';
    roleId?: number;
    onSuccess: () => void;
};

type Permission = { id: number; name: string; status: boolean; createdAt: string; updatedAt?: string };
type RoleDTO = {
    id: number;
    name: string;
    description?: string | null;
    status: boolean;
    permissions?: (number | Permission)[];
};

export default function RoleForm({ mode, roleId, onSuccess }: Props) {
    const text = useThemeColor({}, 'text');
    const muted = useThemeColor({}, 'muted');
    const tint = useThemeColor({}, 'tint');
    const border = useThemeColor({}, 'border');
    const fieldBg = useThemeColor({}, 'fieldBg');
    const surface = useThemeColor({}, 'surface');

    const ripple = (c: string) => (Platform.OS === 'android' ? { android_ripple: { color: c } } : {});

    const [loading, setLoading] = useState(mode === 'edit');
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    // const [description, setDescription] = useState('');
    const [status, setStatus] = useState(true);

    const [allPerms, setAllPerms] = useState<Permission[]>([]);
    const [selectedPermIds, setSelectedPermIds] = useState<Set<number | string>>(new Set());

    const canSubmit = useMemo(() => !!name.trim() && !saving, [name, saving]);

    const allPermsOptions: PermissionOption[] = allPerms.map(p => ({ id: p.id, name: p.name }));

    useEffect(() => {
        let mounted = true;

        const fetchAll = async () => {
            try {
                const p = await api.get<Permission[]>('/api/v1/admin/permission/getAll');
                if (!mounted) return;
                setAllPerms(p.data ?? []);

                if (mode === 'edit' && roleId) {
                    const r = await api.get<RoleDTO>(`/api/v1/admin/role/${roleId}`);
                    if (!mounted) return;
                    const role = r.data;

                    setName(role.name ?? '');
                    setStatus(!!role.status);
                    console.log(role.permissions);
                    const ids = new Set<number | string>();
                    for (const it of role.permissions ?? []) {
                        if (typeof it === 'number') ids.add(it);
                        else if (it && typeof it === 'object' && 'id' in it) ids.add((it as Permission).id);
                    }
                    setSelectedPermIds(ids);
                }
            } catch (e: any) {
                console.warn('RoleForm fetch error:', e?.response ?? e);
                Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'No se pudo cargar datos del rol');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchAll();
        return () => { mounted = false; };
    }, [mode, roleId]);

    const onSubmit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {

            const base = {
                name: name.trim(),
                status,
            };
            const payload = mode === 'edit'
                ? { ...base, permissions: Array.from(selectedPermIds).map(Number) }
                : base;

            if (mode === 'edit' && roleId) await api.put(`/api/v1/admin/role/${roleId}`, payload);
            else await api.post(`/api/v1/admin/role/`, payload);

            onSuccess();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'No se pudo guardar el rol');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }}>
                <ActivityIndicator />
                <Text style={{ color: muted, marginTop: 8 }}>Cargando…</Text>
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            {/* Nombre */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: muted }]}>Nombre del rol</Text>
                <TextInput
                    placeholder="Ej. Administrador"
                    value={name}
                    onChangeText={setName}
                    style={[styles.input, { backgroundColor: fieldBg, borderColor: border, color: text }]}
                    placeholderTextColor={muted}
                    autoCapitalize="sentences"
                />
            </View>

            {/* Estado */}
            <View style={[styles.switchRow, { borderColor: border }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: text, fontWeight: '700' }}>Activo</Text>
                    <Text style={{ color: muted, marginTop: 2 }}>Controla si el rol puede asignarse a usuarios.</Text>
                </View>
                <Switch
                    value={status}
                    onValueChange={setStatus}
                    thumbColor={Platform.OS === 'android' ? (status ? '#fff' : '#f1f5f9') : undefined}
                    trackColor={{ false: '#94a3b8', true: tint }}
                />
            </View>

            {mode === 'edit' ? (
                <PermissionsPicker
                    options={allPermsOptions}
                    value={selectedPermIds}
                    onChange={setSelectedPermIds}
                    searchable
                    minItemWidth={170}
                    internalScroll={false} // evita nested VirtualizedList si RoleForm está en un ScrollView
                />
            ) : (
                // Opcional: mensaje informativo en creación
                <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: border, backgroundColor: surface, borderRadius: 12, padding: 10 }}>
                    <Text style={{ color: muted }}>
                        Los permisos se podrán asignar una vez creado el rol.
                    </Text>
                </View>
            )}



            {/* Acciones */}
            <View style={styles.actions}>
                <Pressable
                    onPress={onSubmit}
                    disabled={!canSubmit}
                    style={({ pressed }) => [
                        styles.cta,
                        { backgroundColor: canSubmit ? tint : '#94a3b8' },
                        pressed && canSubmit && { opacity: 0.9 },
                    ]}
                    {...ripple('#00000022')}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '800' }}>
                                {mode === 'edit' ? 'Guardar cambios' : 'Crear rol'}
                            </Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 12,
        gap: 12,
    },
    field: { gap: 6 },
    label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        fontSize: 14,
    },
    inputArea: { minHeight: 92, textAlignVertical: 'top' },
    switchRow: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    actions: { alignItems: 'flex-end', marginTop: 4 },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
    },
});
