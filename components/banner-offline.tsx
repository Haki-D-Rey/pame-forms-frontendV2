// components/BannerOffline.tsx
import useOnline from '@/hooks/use-online';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function BannerOffline() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Sin conexión a Internet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    alignItems: 'center',
  },
  text: { color: '#fff', fontWeight: '700' },
});
