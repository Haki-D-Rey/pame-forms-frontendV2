import { ThemedText } from '@/components/themed-text';
import UserForm from '@/components/users/user-form';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const router = useRouter();

  return (
    // <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText type="title">Editar usuario #{userId}</ThemedText>
          <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f3f4f6' }}>
            <MaterialCommunityIcons name="arrow-left" size={18} color="#374151" />
          </Pressable>
        </View>

        <UserForm
          mode="edit"
          userId={userId}
          onSuccess={() => {
            Alert.alert('Éxito', 'Usuario actualizado', [{ text: 'OK', onPress: () => router.replace('/(admin)/security/users') }]);
          }}
        />
      </ScrollView>
    // </KeyboardAvoidingView>
  );
}
