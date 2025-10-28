// app/(auth)/reset-password.tsx
import { useGlobalAlert } from '@/components/global-alert-component';
import Loader from '@/components/loader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { z } from 'zod';

const Schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string().min(6, 'Mínimo 6 caracteres'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

type Form = z.infer<typeof Schema>;

export default function ResetPasswordScreen() {
  const { email, resetToken } = useLocalSearchParams<{ email: string; resetToken: string }>();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const { show } = useGlobalAlert();

  const text = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');
  const muted = Platform.OS === 'ios' ? '#8E8E93' : '#9AA0A6';

  const {
    handleSubmit,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(Schema), mode: 'onChange' });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [postNewPassword, setPostNewPassword] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  // Animaciones (RN Animated)
  const fade1 = useRef(new Animated.Value(0)).current;
  const slide1 = useRef(new Animated.Value(12)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const slide2 = useRef(new Animated.Value(12)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slide1, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fade2, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slide2, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fade1, slide1, fade2, slide2]);

  useEffect(() => {
    const visible = isSubmitting || postNewPassword;
    Animated.timing(overlayOpacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isSubmitting, postNewPassword, overlayOpacity]);

  const onSubmit = async ({ password }: Form) => {
    try {
      setPostNewPassword(true);
      await resetPassword({
        email: String(email),
        resetToken: String(resetToken),
        newPassword: password,
      });
      show({
        type: 'success',
        title: 'Cambio de Contraseña',
        message: `La contraseña se ha cambiado correctamente al usuario ${email}`,
        duration: 2500,
        logo: require('@/assets/images/pame-logo-t.png'),
      });

      await new Promise((r) => setTimeout(r, 2000));
      setPostNewPassword(false);
      router.replace('/(auth)/auth/login');
    } catch {
      setPostNewPassword(false);
      show({
        type: 'error',
        title: 'Cambio de Contraseña',
        message: 'Hubo un problema con el servicio del cambio de contraseña',
        duration: 2000,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
    }
  };

  const overlayVisible = isSubmitting || postNewPassword;

  return (
    <ThemedView style={[styles.container, { backgroundColor: bg }]}>
      {/* Blobs */}
      <Animated.View style={[styles.blobWrap, { opacity: fade1 }]} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: tint + '22', top: -60, right: -40 }]} />
        <View
          style={[
            styles.blob,
            { backgroundColor: tint + '1A', bottom: -80, left: -50, width: 260, height: 260 },
          ]}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        {/* Header/logo */}
        <Animated.View style={[styles.header, { opacity: fade1, transform: [{ translateY: slide1 }] }]}>
          <Image source={require('@/assets/images/pame-logo-t.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.header, { opacity: fade1, transform: [{ translateY: slide1 }] }]}>
          <ThemedText style={[styles.brand, { color: text }]}>Nueva contraseña</ThemedText>
          <ThemedText style={[styles.subtitle, { color: text }]}>
            Establece tu nueva contraseña para{' '}
            <ThemedText style={{ fontWeight: '800' }}>{String(email)}</ThemedText>
          </ThemedText>
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: bg, opacity: fade2, transform: [{ translateY: slide2 }] },
          ]}
        >
          {/* Password */}
          <View style={styles.fieldWrap}>
            <TextInput
              placeholder="Contraseña nueva"
              placeholderTextColor={muted}
              secureTextEntry={!showPass}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="next"
              onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
              onSubmitEditing={() => confirmRef.current?.focus()}
              style={[styles.input, { color: text, paddingRight: 44 }]}
            />
            <Pressable onPress={() => setShowPass((v) => !v)} style={styles.rightAdornment}>
              <MaterialCommunityIcons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#64748b"
              />
            </Pressable>
          </View>
          {errors.password && <ThemedText style={styles.errorText}>{errors.password.message}</ThemedText>}

          {/* Confirm */}
          <View style={styles.fieldWrap}>
            <TextInput
              ref={confirmRef}
              placeholder="Confirmar contraseña"
              placeholderTextColor={muted}
              secureTextEntry={!showConfirm}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="go"
              onChangeText={(t) => setValue('confirm', t, { shouldValidate: true })}
              onSubmitEditing={handleSubmit(onSubmit)}
              style={[styles.input, { color: text, paddingRight: 44 }]}
            />
            <Pressable onPress={() => setShowConfirm((v) => !v)} style={styles.rightAdornment}>
              <MaterialCommunityIcons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#64748b"
              />
            </Pressable>
          </View>
          {errors.confirm && <ThemedText style={styles.errorText}>{errors.confirm.message}</ThemedText>}

          <Pressable
            disabled={!isValid || isSubmitting}
            onPress={handleSubmit(onSubmit)}
            style={[styles.primaryButton, { backgroundColor: isValid ? tint : '#9CA3AF' }]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Guardar</ThemedText>
            )}
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Pressable onPress={() => router.push('/(auth)/auth/login')}>
              <ThemedText style={styles.linkText}>Volver a iniciar sesión</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Loader overlay con fade in/out */}
      <Animated.View
        pointerEvents={overlayVisible ? 'box-none' : 'none'}
        style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
      >
        {overlayVisible && (
          <Loader
            visible
            variant="overlay"
            message={isSubmitting ? 'Cambiando Contraseña…' : 'Preparando tu panel…'}
            backdropOpacity={0.45}
          />
        )}
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  kav: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { marginBottom: 18, alignItems: 'center' },
  brand: { fontSize: 24, fontWeight: '800', letterSpacing: 0.4 },
  subtitle: { fontSize: 13, opacity: 0.8, marginTop: 4, textAlign: 'center' },
  card: {
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffffff22',
    // backdropFilter: 'blur(4px)' as any, // solo web
  },
  fieldWrap: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#00000022',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  input: { height: 52, borderRadius: 12, paddingHorizontal: 12 },
  rightAdornment: {
    position: 'absolute',
    right: 8,
    top: 0,
    height: 52,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkText: { textDecorationLine: 'underline', fontWeight: '600' },
  errorText: { color: '#ef4444', marginTop: 6, fontSize: 13 },
  blobWrap: { position: 'absolute', inset: 0 },
  logo: { width: 110, height: 110, marginBottom: 10 },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 9999,
    transform: [{ rotate: '20deg' }],
    // filter: 'blur(40px)' as any, // solo web
  },
});
