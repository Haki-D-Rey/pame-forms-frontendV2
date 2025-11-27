import { useThemeColor } from '@/hooks/use-theme-color';
import { PermissionSafeDTO } from '@/types/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

interface PermissionRowActionsProps {
  permission: PermissionSafeDTO;
  deleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PermissionRowActions({ permission, deleting, onEdit, onDelete }: PermissionRowActionsProps) {
  const iconColor = useThemeColor({}, 'text');
  const danger = '#ef4444';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {/* Botón Editar */}
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => ({
          padding: 8,
          opacity: pressed ? 0.7 : 1,
          backgroundColor: 'transparent', // O un color suave de fondo
          borderRadius: 8,
        })}
      >
        <MaterialCommunityIcons name="pencil-outline" size={20} color={iconColor} />
      </Pressable>

      {/* Botón Eliminar */}
      <Pressable
        onPress={onDelete}
        disabled={deleting}
        style={({ pressed }) => ({
          padding: 8,
          opacity: pressed || deleting ? 0.7 : 1,
          backgroundColor: 'transparent',
          borderRadius: 8,
        })}
      >
        {deleting ? (
          <ActivityIndicator size="small" color={danger} />
        ) : (
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={danger} />
        )}
      </Pressable>
    </View>
  );
}