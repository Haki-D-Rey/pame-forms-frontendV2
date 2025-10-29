// app/(auth)/register.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const RegisterSchema = z
  .object({
    email: z.string().email('Correo inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string().min(6, 'Mínimo 6 caracteres'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

type RegisterForm = z.infer<typeof RegisterSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { register: signUp } = useAuth(); // evitar conflicto con RHF "register"

  // ===== tokens centralizados (hooks SIEMPRE al tope, nunca condicionales) =====
  const text        = useThemeColor({}, 'text');
  const bg          = useThemeColor({}, 'background');
  const primary     = useThemeColor({}, 'primary');
  const muted       = useThemeColor({}, 'muted');
  const surface     = useThemeColor({}, 'surface');
  const border      = useThemeColor({}, 'border');
  const fieldBg     = useThemeColor({}, 'fieldBg');
  const fieldBorder = useThemeColor({}, 'fieldBorder');
  const placeholder = useThemeColor({}, 'placeholder');
  const errorColor  = useThemeColor({}, 'error');
  const disabled    = useThemeColor({}, 'disabled');
  const tint        = useThemeColor({}, 'tint');

  const styles = useMemo(
    () =>
      createStyles({
        text, bg, primary, muted, surface, border, fieldBg, fieldBorder, placeholder, errorColor, disabled,
      }),
    [text, bg, primary, muted, surface, border, fieldBg, fieldBorder, placeholder, errorColor, disabled]
  );

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
    register: rhfRegister,
  } = useForm<RegisterForm>({ resolver: zodResolver(RegisterSchema), mode: 'onChange' });

  // Registra campos para que setValue actualice el estado interno de RHF
  useEffect(() => {
    rhfRegister('email');
    rhfRegister('password');
    rhfRegister('confirm');
  }, [rhfRegister]);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Animaciones
  const fade1 = useRef(new Animated.Value(0)).current;
  const slide1 = useRef(new Animated.Value(12)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const slide2 = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slide1, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fade2, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slide2, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [fade1, slide1, fade2, slide2]);

  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.timing(scale, { toValue: 0.98, duration: 90, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(scale, { toValue: 1,    duration: 90, useNativeDriver: true }).start();

  const password = watch('password') || '';
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (password.length >= 12) score += 1;
    return score; // 0..5
  }, [password]);

  const onSubmit = async (data: RegisterForm) => {
    await signUp({ email: data.email.trim().toLowerCase(), password: data.password, role: 'UserStandard' });
    router.replace('/(auth)/auth/login');
  };

  // ───────────────────────── helpers DENTRO del componente ─────────────────────────
  // Acceden a "styles" y a los tokens por cierre (sin hooks aquí ⇒ sin rule-of-hooks warning)
  const FloatingInput = ({
    label,
    error,
    iconRight,
    style,
    secureTextEntry,
    keyboardType,
    autoCapitalize,
    onChangeText,
  }: {
    label: string;
    error?: string;
    iconRight?: React.ReactNode;
    style?: any;
    secureTextEntry?: boolean;
    keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
    autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
    onChangeText?: (t: string) => void;
  }) => {
    const [focused, setFocused] = useState(false);
    const [value, setValueLocal] = useState('');

    const borderCol = error ? errorColor : focused ? primary : fieldBorder;

    return (
      <View style={[styles.field, style, { borderColor: borderCol, backgroundColor: fieldBg }]}>
        <TextInput
          value={value}
          onChangeText={(t) => {
            setValueLocal(t);
            onChangeText?.(t);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={label}
          placeholderTextColor={placeholder}
          style={[styles.input, { color: text, paddingRight: iconRight ? 44 : 12 }]}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {iconRight ? <View style={styles.rightAdornment}>{iconRight}</View> : null}
        {error ? <ThemedText style={[styles.errorText, { color: errorColor }]}>{error}</ThemedText> : null}
      </View>
    );
  };

  const PasswordStrength = ({ strength }: { strength: number }) => {
    // SIN hooks aquí; usamos tokens ya calculados arriba
    const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte', 'Excelente'];
    const barColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#16a34a'];
    const pct = Math.min(100, Math.max(0, (strength / 5) * 100));

    return (
      <View style={{ marginTop: -4 }}>
        <View style={[styles.strengthBarBg, { backgroundColor: fieldBorder }]}>
          <View style={[styles.strengthBarFill, { width: `${pct}%`, backgroundColor: barColors[strength] || primary }]} />
        </View>
        <ThemedText style={[styles.strengthLabel, { color: muted }]}>{labels[strength] || ' '}</ThemedText>
      </View>
    );
  };
  // ────────────────────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={[styles.container, { backgroundColor: bg }]}>
      {/* Blobs decorativos */}
      <Animated.View style={[styles.blobWrap, { opacity: fade1 }]} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: tint + '22', top: -60, right: -40 }]} />
        <View style={[styles.blob, { backgroundColor: tint + '1A', bottom: -80, left: -50, width: 260, height: 260 }]} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fade1, transform: [{ translateY: slide1 }] }]}>
          <Image
            source={require('@/assets/images/pame-logo-t.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Logo de PameForms"
          />
        </Animated.View>

        <Animated.View style={[styles.header, { opacity: fade1, transform: [{ translateY: slide1 }] }]}>
          <ThemedText style={styles.brand}>Crear cuenta</ThemedText>
          <ThemedText style={styles.subtitle}>Regístrate para administrar tus formularios y reportes</ThemedText>
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: surface, borderColor: border, opacity: fade2, transform: [{ translateY: slide2 }] },
          ]}
        >
          <View style={{ rowGap: 12 }}>
            <FloatingInput
              label="Correo"
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={(t) => setValue('email', t, { shouldValidate: true })}
              error={errors.email?.message}
              iconRight={<MaterialCommunityIcons name="email-outline" size={18} color={muted} />}
            />

            <FloatingInput
              label="Contraseña"
              secureTextEntry={!showPass}
              onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
              error={errors.password?.message}
              iconRight={
                <Pressable onPress={() => setShowPass((v) => !v)} style={styles.iconBtn} accessibilityRole="button">
                  <MaterialCommunityIcons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={muted} />
                </Pressable>
              }
            />

            <PasswordStrength strength={strength} />

            <FloatingInput
              label="Confirmar contraseña"
              secureTextEntry={!showConfirm}
              onChangeText={(t) => setValue('confirm', t, { shouldValidate: true })}
              error={errors.confirm?.message}
              iconRight={
                <Pressable onPress={() => setShowConfirm((v) => !v)} style={styles.iconBtn} accessibilityRole="button">
                  <MaterialCommunityIcons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={muted} />
                </Pressable>
              }
            />
          </View>

          {/* CTA */}
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: isValid && !isSubmitting ? primary : disabled }]}
              onPress={handleSubmit(onSubmit)}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.primaryButtonText}>Registrarme</ThemedText>}
            </Pressable>
          </Animated.View>

          {/* Enlace login */}
          <View style={styles.secondaryRow}>
            <Pressable onPress={() => router.push('/(auth)/auth/login')} style={styles.link}>
              <ThemedText style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.legal}>Al continuar aceptas nuestros Términos y la Política de Privacidad.</ThemedText>
        </Animated.View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/* ───────────────────────── styles ───────────────────────── */
function createStyles(c: {
  text: string; bg: string; primary: string; muted: string; surface: string; border: string;
  fieldBg: string; fieldBorder: string; placeholder: string; errorColor: string; disabled: string;
}) {
  return StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: c.bg },
    kav: { width: '100%', maxWidth: 520, alignSelf: 'center' },

    header: { marginBottom: 18, alignItems: 'center' },
    brand: { fontSize: 26, fontWeight: '800', letterSpacing: 0.4, color: c.text },
    subtitle: { fontSize: 14, opacity: 0.8, marginTop: 4, textAlign: 'center', color: c.text },

    card: {
      borderRadius: 20,
      padding: 18,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      elevation: 10,
    },

    blobWrap: { position: 'absolute', inset: 0 },
    logo: { width: 124, height: 124, marginBottom: 10 },
    blob: { position: 'absolute', width: 220, height: 220, borderRadius: 9999, transform: [{ rotate: '20deg' }] },

    field: { position: 'relative', borderWidth: 1, borderRadius: 12, marginBottom: 8, backgroundColor: c.fieldBg, borderColor: c.fieldBorder },
    input: { height: 52, borderRadius: 12, paddingHorizontal: 12, color: c.text },
    rightAdornment: { position: 'absolute', right: 8, top: 0, height: 52, width: 36, alignItems: 'center', justifyContent: 'center' },

    errorText: { marginTop: 6, fontSize: 13, color: c.errorColor },

    primaryButton: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: c.primary },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    secondaryRow: { marginTop: 14, alignItems: 'center' },
    link: { paddingVertical: 6 },
    linkText: { textDecorationLine: 'underline', fontWeight: '600', color: c.primary },

    legal: { fontSize: 12, opacity: 0.6, marginTop: 16, textAlign: 'center', color: c.text },

    strengthBarBg: { height: 6, borderRadius: 999, overflow: 'hidden' },
    strengthBarFill: { height: '100%' },
    strengthLabel: { marginTop: 6, fontSize: 11, fontWeight: '700', textAlign: 'right' },

    iconBtn: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  });
}
