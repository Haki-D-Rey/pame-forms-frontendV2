// app/(auth)/verify-code.tsx
import { useGlobalAlert } from '@/components/global-alert-component';
import Loader from '@/components/loader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth';
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

const Schema = z.object({ code: z.string().min(4).max(8) });
type Form = z.infer<typeof Schema>;

export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const { verifyResetCode, requestPasswordReset } = useAuth();
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

  const [focus, setFocus] = useState(false);
  const [seconds, setSeconds] = useState(45);
  const [postVerify, setPostVerify] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const busy = isSubmitting || postVerify;
  const busyMsg = isSubmitting ? 'Verificando el código…' : 'Preparando tu panel…';

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // Animaciones (RN Animated)
  const fadeHdr = useRef(new Animated.Value(0)).current;
  const slideHdr = useRef(new Animated.Value(12)).current;
  const fadeCard = useRef(new Animated.Value(0)).current;
  const slideCard = useRef(new Animated.Value(12)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrada secuencial: header luego card
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeHdr, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideHdr, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeCard, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideCard, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // autofocus una vez entra la vista
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }, [fadeHdr, slideHdr, fadeCard, slideCard]);

  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: busy ? 1 : 0,
      duration: busy ? 180 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [busy, overlayOpacity]);

  const onSubmit = async ({ code }: Form) => {
    try {
      setPostVerify(true);
      const response = await verifyResetCode({ email: String(email), code: code.trim() });
      show({
        type: 'success',
        title: 'Verificación de código',
        message: `El código ${code} fue verificado correctamente para ${email}`,
        duration: 2500,
        logo: require('@/assets/images/pame-logo-t.png'),
      });

      await new Promise((r) => setTimeout(r, 2000));
      setPostVerify(false);
      router.push({
        pathname: '/(auth)/auth/reset-password',
        params: { email, resetToken: response.resetToken },
      });
    } catch {
      show({
        type: 'error',
        title: 'Código inválido',
        message: `El código ingresado no es válido.`,
        duration: 2000,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
    } finally {
      setPostVerify(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    setPostVerify(true);
    try {
      await requestPasswordReset(String(email));
      show({
        type: 'success',
        title: 'Reenvío de código',
        message: `Se ha reenviado el código a ${email}`,
        duration: 2500,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
      await new Promise((r) => setTimeout(r, 2000));
      setPostVerify(false);
      setSeconds(45);
    } catch {
      show({
        type: 'error',
        title: 'Reenvío de código',
        message: 'No se pudo reenviar el código.',
        duration: 2000,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
    } finally {
      setPostVerify(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bg }]}>
      {/* Blobs */}
      <Animated.View style={[styles.blobWrap, { opacity: fadeHdr }]} pointerEvents="none">
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
        {/* Header/logo + títulos */}
        <Animated.View style={[styles.header, { opacity: fadeHdr, transform: [{ translateY: slideHdr }] }]}>
          <Image source={require('@/assets/images/pame-logo-t.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.header, { opacity: fadeHdr, transform: [{ translateY: slideHdr }] }]}>
          <ThemedText style={[styles.brand, { color: text }]}>Verificar código</ThemedText>
          <ThemedText style={[styles.subtitle, { color: text }]}>
            Enviamos un código a <ThemedText style={{ fontWeight: '800' }}>{String(email)}</ThemedText>
          </ThemedText>
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[styles.card, { backgroundColor: bg, opacity: fadeCard, transform: [{ translateY: slideCard }] }]}
        >
          <View style={[styles.fieldWrap, focus && { borderColor: tint }]}>
            <TextInput
              ref={inputRef}
              placeholder="Código de verificación"
              placeholderTextColor={muted}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onChangeText={(t) => setValue('code', t, { shouldValidate: true })}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              style={[styles.input, { color: text, letterSpacing: 4, textAlign: 'center' }]}
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          </View>
          {errors.code && <ThemedText style={styles.errorText}>{errors.code.message}</ThemedText>}

          <Pressable
            disabled={!isValid || isSubmitting}
            onPress={handleSubmit(onSubmit)}
            style={[styles.primaryButton, { backgroundColor: isValid ? tint : '#9CA3AF' }]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Continuar</ThemedText>
            )}
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Pressable onPress={resend} disabled={seconds > 0}>
              <ThemedText style={[styles.linkText, { opacity: seconds > 0 ? 0.5 : 1 }]}>
                {seconds > 0 ? `Reenviar en ${seconds}s` : 'Reenviar código'}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Loader overlay con fade in/out (RN Animated) */}
      <Animated.View
        pointerEvents={busy ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
      >
        {busy && (
          <Loader visible variant="overlay" message={busyMsg} backdropOpacity={0.45} />
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
