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
    permissionId?: number;
    onSuccess: () => void;
};

type PermissionDTO = {
    id: number;
    name: string;
    description?: string | null;
    status: boolean;
};

export default function PermissionForm({ mode, permissionId, onSuccess }: Props) {
    // Tokens de diseño
    const text = useThemeColor({}, 'text');
    const muted = useThemeColor({}, 'muted');
    const tint = useThemeColor({}, 'tint');
    const border = useThemeColor({}, 'border');
    const fieldBg = useThemeColor({}, 'fieldBg');
    const surface = useThemeColor({}, 'surface');

    const ripple = (c: string) => (Platform.OS === 'android' ? { android_ripple: { color: c } } : {});

    const [loading, setLoading] = useState(mode === 'edit');
    const [saving, setSaving] = useState(false);

    // Campos del formulario
    const [name, setName] = useState('');
    const [status, setStatus] = useState(true);

    const canSubmit = useMemo(() => !!name.trim() && !saving, [name, saving]);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            if (mode === 'create' || !permissionId) {
                setLoading(false);
                return;
            }

            try {
                const response = await api.get<PermissionDTO>(`/api/v1/admin/permission/${permissionId}`);
                if (!mounted) return;
                
                const data = response.data;
                setName(data.name ?? '');
                setStatus(!!data.status);

            } catch (e: any) {
                console.warn('PermissionForm fetch error:', e?.response ?? e);
                Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'No se pudo cargar el permiso');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [mode, permissionId]);

    const onSubmit = async () => {
        if (!canSubmit) return;
        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                status,
            };

            if (mode === 'edit' && permissionId) {
                await api.patch(`/api/v1/admin/permission/${permissionId}`, payload);
            } else {
                await api.post(`/api/v1/admin/permission/`, payload);
            }

            onSuccess();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'No se pudo guardar el permiso');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }}>
                <ActivityIndicator color={tint} />
                <Text style={{ color: muted, marginTop: 8 }}>Cargando información...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            {/* Nombre */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: muted }]}>Nombre del permiso</Text>
                <TextInput
                    placeholder="Ej. CREATE_USER"
                    value={name}
                    onChangeText={setName}
                    style={[styles.input, { backgroundColor: fieldBg, borderColor: border, color: text }]}
                    placeholderTextColor={muted}
                    autoCapitalize="none" 
                />
            </View>

            {/* Estado */}
            <View style={[styles.switchRow, { borderColor: border }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: text, fontWeight: '700' }}>Activo</Text>
                    <Text style={{ color: muted, marginTop: 2 }}>Si se desactiva, este permiso dejará de tener efecto.</Text>
                </View>
                <Switch
                    value={status}
                    onValueChange={setStatus}
                    thumbColor={Platform.OS === 'android' ? (status ? '#fff' : '#f1f5f9') : undefined}
                    trackColor={{ false: '#94a3b8', true: tint }}
                />
            </View>

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
                                {mode === 'edit' ? 'Guardar cambios' : 'Crear permiso'}
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