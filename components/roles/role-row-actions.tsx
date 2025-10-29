// RoleRowActions.tsx
import { RoleSafeDTO } from '@/types/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

// type Role = {
//     id: number;
//     name: string;
//     status: boolean;      // activo/inactivo
//     isSystem?: boolean;   // true si es rol del sistema (no se debe eliminar)
//     code?: string;
// };

type Props = {
    role: RoleSafeDTO;
    onEdit: () => void;
    onDelete: () => void;
    deleting?: boolean;
    roleHasPermission: () => void; // abre el flujo de permisos del rol
};

export default function RoleRowActions({
    role,
    onEdit,
    onDelete,
    deleting = false,
    roleHasPermission,
}: Props) {
    const isActive = !!role.status;
    const deleteDisabled = !isActive || deleting;

    return (
        <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Permisos del rol */}
            <Pressable
                onPress={roleHasPermission}
                style={({ pressed }) => [
                    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: deleteDisabled ? '#f5f5f5' : 'rgba(224, 242, 254, 0.68)' },
                    pressed && { opacity: 0.9 },
                ]}
                disabled={deleteDisabled}
                accessibilityRole="button"
                accessibilityLabel={`Gestionar permisos de ${role.name}`}
                {...(Platform.OS === 'android'
                    ? { android_ripple: { color: '#00000010', borderless: false } }
                    : {})}
            >
                {deleting ? (
                    <ActivityIndicator size="small" />
                ) : (
                    <MaterialCommunityIcons
                        name="shield-key-outline"
                        size={18}
                        color={deleteDisabled ? '#9ca3af' : '#0369a1'}
                    />
                )}
            </Pressable>

            {/* Editar rol */}
            <Pressable
                onPress={onEdit}
                style={({ pressed }) => [
                    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: deleteDisabled ? '#f5f5f5' : '#f3f4f6' },
                    pressed && { opacity: 0.9 },
                ]}
                disabled={deleteDisabled}
                accessibilityRole="button"
                accessibilityLabel={`Editar rol ${role.name}`}
                {...(Platform.OS === 'android'
                    ? { android_ripple: { color: '#00000010', borderless: false } }
                    : {})}
            >
                {/* <MaterialCommunityIcons
                    name="pencil-outline"
                    size={16}
                    color="#374151"
                /> */}
                {deleting ? (
                    <ActivityIndicator size="small" />
                ) : (
                    <MaterialCommunityIcons
                        name="pencil-outline"
                        size={18}
                        color={deleteDisabled ? '#9ca3af' : '#374151'}
                    />
                )}
            </Pressable>

            {/* Eliminar rol */}
            <Pressable
                onPress={() => { if (!deleteDisabled) onDelete(); }}
                disabled={deleteDisabled}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar rol ${role.name}`}
                accessibilityState={{ disabled: deleteDisabled }}
                style={({ pressed }) => [
                    {
                        padding: 8,
                        borderRadius: 999,
                        backgroundColor: deleteDisabled ? '#f5f5f5' : '#fee2e2',
                        opacity: pressed ? 0.9 : 1,
                    },
                    deleting && { opacity: 0.6 },
                ]}
                {...(Platform.OS === 'android' && !deleteDisabled
                    ? { android_ripple: { color: '#00000010', borderless: false } }
                    : {})}
            >
                {deleting ? (
                    <ActivityIndicator size="small" />
                ) : (
                    <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color={deleteDisabled ? '#9ca3af' : '#dc2626'}
                    />
                )}
            </Pressable>
        </View>
    );
}
