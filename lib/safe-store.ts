// src/lib/safe-store.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export async function safeSet(key: string, value: string) {
  const available = await SecureStore.isAvailableAsync();
  if (available) return SecureStore.setItemAsync(key, value);
  return AsyncStorage.setItem(key, value);
}
export async function safeGet(key: string) {
  const available = await SecureStore.isAvailableAsync();
  if (available) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}
export async function safeDel(key: string) {
  const available = await SecureStore.isAvailableAsync();
  if (available) return SecureStore.deleteItemAsync(key);
  return AsyncStorage.removeItem(key);
}
