// app/(admin)/security/roles/[id].tsx
import RoleForm from '@/components/roles/role-form';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function EditRoleScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const roleId = Number(id);
    const router = useRouter();

    // tokens
    const text = useThemeColor({}, 'text');
    const border = useThemeColor({}, 'border');
    const surface = useThemeColor({}, 'surface');

    const ripple = (c: string) =>
        Platform.OS === 'android' ? { android_ripple: { color: c } } : {};

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: surface }}
            removeClippedSubviews={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 12, gap: 12 }}
        >
            {/* Header */}
            <View style={[styles.headerWrap, { backgroundColor: surface, borderColor: border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [
                            styles.iconPill,
                            { borderColor: border, backgroundColor: surface },
                            pressed && { opacity: 0.9 },
                        ]}
                        {...ripple('#00000022')}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={18} color={text} />
                    </Pressable>

                    <ThemedText type="title">Editar rol #{roleId}</ThemedText>
                </View>
            </View>

            <RoleForm
                mode="edit"
                roleId={roleId}
                onSuccess={() => {
                    Alert.alert('Éxito', 'Rol actualizado', [
                        { text: 'OK', onPress: () => router.replace('/(admin)/security/roles') },
                    ]);
                }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    headerWrap: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 12,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconPill: {
        height: 36,
        width: 36,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
});
