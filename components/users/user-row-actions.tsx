import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

type Props = {
  user: { id: number; email: string; status: boolean };
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
  onChangePassword: () => void; // abre el flow de contraseña
};

export default function UserRowActions({
  user,
  onEdit,
  onDelete,
  deleting = false,
  onChangePassword,
}: Props) {
  const isActive = !!user.status;
  const deleteDisabled = !isActive || deleting;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {/* Cambiar contraseña */}
      <Pressable
        onPress={onChangePassword}
        style={({ pressed }) => [
          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e0f2fe' },
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar contraseña de ${user.email}`}
      >
        <MaterialCommunityIcons name="key-variant" size={18} color={deleteDisabled ? '#9ca3af' : '#0369a1'} />
      </Pressable>

      {/* Editar */}
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f3f4f6' },
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="pencil-outline" size={16} color={deleteDisabled ? '#9ca3af' : '#374151'} />
      </Pressable>

      {/* Eliminar */}
      <Pressable
        onPress={() => { if (!deleteDisabled) onDelete(); }}
        disabled={deleteDisabled}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${user.email}`}
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
