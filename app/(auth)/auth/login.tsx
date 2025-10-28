// app/(auth)/login.tsx
import { useGlobalAlert } from '@/components/global-alert-component';
import Loader from '@/components/loader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    ActivityIndicator,
    Animated,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
});
type LoginForm = z.infer<typeof LoginSchema>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  // Tema
  const textColor = useThemeColor({}, 'text');
  const bgColor = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');
  const muted = useMemo(() => (Platform.OS === 'ios' ? '#8E8E93' : '#9AA0A6'), []);
  const scheme = useColorScheme();
  const logoSource =
    scheme === 'dark'
      ? require('@/assets/images/pame-logo-t.png')
      : require('@/assets/images/pame-logo-t.png');

  const [focus, setFocus] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [postLogin, setPostLogin] = useState(false);
  const { show } = useGlobalAlert();

  const awaitAlert = async (opts: {
    type: 'success' | 'error';
    title: string;
    message: string;
    duration?: number;
    logo?: any;
  }) => {
    const duration = opts.duration ?? 1500;
    show({ ...opts, duration });
    await sleep(duration + 350);
  };

  const {
    control,
    handleSubmit,
    reset,
    clearErrors,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const [showPass, setShowPass] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const clearForm = () => {
    reset({ email: '', password: '' });
    clearErrors();
    setFocus((s) => ({ ...s, email: true, password: false }));
    requestAnimationFrame(() => {
      emailRef.current?.focus();
    });
  };

  // === Animaciones (RN Animated) ===
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(12)).current;

  const fadeIn2 = useRef(new Animated.Value(0)).current;
  const slideUp2 = useRef(new Animated.Value(12)).current;

  const fadeFooter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeIn2, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideUp2, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
      Animated.timing(fadeFooter, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp, fadeIn2, slideUp2, fadeFooter]);

  // Scale del botón
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(btnScale, { toValue: 0.98, duration: 90, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(btnScale, { toValue: 1, duration: 90, useNativeDriver: true }).start();

  // Overlay loader (fade)
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [showOverlay, setShowOverlay] = useState(false);
  useEffect(() => {
    const on = isSubmitting || postLogin;
    if (on) {
      setShowOverlay(true);
      Animated.timing(overlayOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setShowOverlay(false);
        }
      );
    }
  }, [isSubmitting, postLogin, overlayOpacity]);

  const onSubmit = async (data: LoginForm) => {
    try {
      setPostLogin(true);
      await signIn({ email: data.email.trim().toLowerCase(), password: data.password });
      setPostLogin(false);
      await awaitAlert({
        type: 'success',
        title: 'Credenciales Correctas',
        message: 'Bienvenido al Panel Corporativo',
        duration: 1500,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
      await sleep(1000);
    //   router.replace('/(admin)/dashboard/home');
    } catch {
      setPostLogin(false);
      clearForm();
      await awaitAlert({
        type: 'error',
        title: 'Credenciales Incorrectas',
        message:
          'No se pudo iniciar sesión. Verifica tus credenciales e intenta nuevamente',
        duration: 2000,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
    }
  };

  return (
    <>
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Decorativos: blobs */}
        <Animated.View style={[styles.blobWrap, { opacity: fadeIn }]}>
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
          {/* Header con logo */}
          <Animated.View
            style={[styles.header, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
          >
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Logo de PameForms"
            />
          </Animated.View>

          {/* Títulos */}
          <Animated.View
            style={[styles.header, { opacity: fadeIn2, transform: [{ translateY: slideUp2 }] }]}
          >
            <ThemedText style={[styles.brand, { color: textColor }]}>
              Gestión de Formularios
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textColor }]}>
              Accede a tu panel corporativo
            </ThemedText>
          </Animated.View>

          {/* Card */}
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: bgColor, opacity: fadeIn2, transform: [{ translateY: slideUp2 }] },
            ]}
          >
            {/* Email */}
            <View style={[styles.field, focus.email && { borderColor: tint }]}>
              <Controller
                name="email"
                control={control}
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    ref={emailRef}
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocus((s) => ({ ...s, email: false }));
                    }}
                    onFocus={() => setFocus((s) => ({ ...s, email: true }))}
                    placeholder="Correo electrónico"
                    placeholderTextColor={muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    style={[styles.input, { color: textColor }]}
                    clearButtonMode="while-editing"
                  />
                )}
              />
            </View>
            {errors.email && <ThemedText style={styles.errorText}>{errors.email.message}</ThemedText>}

            {/* Password */}
            <View style={[styles.fieldWrap, focus.password && { borderColor: tint }]}>
              <Controller
                name="password"
                control={control}
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    ref={passwordRef}
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setFocus((s) => ({ ...s, password: false }));
                    }}
                    onFocus={() => setFocus((s) => ({ ...s, password: true }))}
                    placeholder="Contraseña"
                    placeholderTextColor={muted}
                    secureTextEntry={!showPass}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    style={[styles.input, { color: textColor, paddingRight: 44 }]}
                  />
                )}
              />

              {/* Botón ojo */}
              <Pressable
                onPress={() => setShowPass((v) => !v)}
                style={styles.rightAdornment}
                accessibilityRole="button"
                accessibilityLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <MaterialCommunityIcons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748b"
                />
              </Pressable>
            </View>
            {errors.password && (
              <ThemedText style={styles.errorText}>{errors.password.message}</ThemedText>
            )}

            {/* Primary CTA */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                accessibilityRole="button"
                style={[
                  styles.primaryButton,
                  { backgroundColor: isValid && !isSubmitting ? tint : '#9CA3AF' },
                ]}
                onPress={handleSubmit(onSubmit)}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Entrar</ThemedText>
                )}
              </Pressable>
            </Animated.View>

            {/* Secundarias */}
            <View style={styles.secondaryRow}>
              <Link href={{ pathname: '/(auth)/auth/register' }} style={styles.link}>
                <ThemedText style={styles.linkText}>Crear cuenta</ThemedText>
              </Link>
              <Link href={{ pathname: '/(auth)/auth/forgot-password' }} style={styles.link}>
                <ThemedText style={styles.linkText}>¿Olvidaste la contraseña?</ThemedText>
              </Link>
            </View>

            {/* Legal */}
            <ThemedText style={styles.legal}>
              Al continuar aceptas nuestros Términos y la Política de Privacidad.
            </ThemedText>
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeFooter }]}>
            <ThemedText style={[styles.footerText, { color: textColor }]}>
              © {new Date().getFullYear()} Pame S.A
            </ThemedText>
          </Animated.View>
        </KeyboardAvoidingView>
      </ThemedView>

      {/* Loader overlay (fade RN Animated) */}
      {showOverlay && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="auto">
          <Loader
            visible
            variant="overlay"
            message={isSubmitting ? 'Autenticando…' : 'Preparando tu panel…'}
            backdropOpacity={0.45}
          />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  kav: { width: '100%', maxWidth: 520, alignSelf: 'center' },

  header: { marginBottom: 18, alignItems: 'center' },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: 0.4 },
  subtitle: { fontSize: 14, opacity: 0.8, marginTop: 4 },

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
    // backdropFilter es solo web. Si lo usas, déjalo en el componente web.
    // backdropFilter: 'blur(4px)' as any,
  },

  field: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00000014',
    backgroundColor: '#00000008',
    marginBottom: 8,
  },
  fieldWrap: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#00000022',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  rightAdornment: {
    position: 'absolute',
    right: 8,
    top: 0,
    height: 52,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#ef4444', marginBottom: 8, fontSize: 13 },

  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  secondaryRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  link: { paddingVertical: 6 },
  linkText: { textDecorationLine: 'underline', fontWeight: '600' },

  legal: { fontSize: 12, opacity: 0.6, marginTop: 16, textAlign: 'center' },

  footer: { marginTop: 18, alignItems: 'center' },
  footerText: { fontSize: 12, opacity: 0.6 },

  blobWrap: { position: 'absolute', inset: 0 },
  logo: { width: 124, height: 124, marginBottom: 10 },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 9999,
    transform: [{ rotate: '20deg' }],
    // filter (CSS) solo aplica en web.
  },
});
