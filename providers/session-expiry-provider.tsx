import { useGlobalAlert } from '@/components/global-alert-component';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { decode as atob } from 'base-64';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  /** segundos para mostrar prompt antes de expirar; 0 = desactiva prompt y cierra al expirar */
  thresholdSec?: number;
  logo?: any;
};

function getJwtExp(token: string | null): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/'); // Base64URL → Base64
    const jsonStr = atob(payload);
    const data = JSON.parse(jsonStr);
    if (typeof data?.exp !== 'number') return null;
    return data.exp > 1_000_000_000_000 ? Math.floor(data.exp / 1000) : data.exp; // ms→s
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SessionExpiryProvider({ children, thresholdSec = 10, logo }: Props) {
  const { getAccessToken, refreshAccessToken, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // UI
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);

  // Control refs
  const shownRef = useRef(false);
  const closingRef = useRef(false);
  const suppressRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const currentExpRef = useRef<number | null>(null);

  // Anim (React Native Animated)
  const openA = useRef(new Animated.Value(0)).current; // 0 cerrado, 1 abierto
  const translateY = openA.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const modalA = { opacity: openA, transform: [{ translateY }] } as const;

  const animateTo = useCallback((to: 0 | 1, duration: number) => {
    Animated.timing(openA, {
      toValue: to,
      duration,
      useNativeDriver: true
    }).start();
  }, [openA]);

  const clearIntervalIfAny = () => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const { show } = useGlobalAlert();
  const awaitAlert = async (opts: {
    type: 'success' | 'error';
    title: string;
    message: string;
    duration?: number;
    logo?: any;
  }) => {
    const duration = opts.duration ?? 1500;
    try {
      show({ ...opts, duration });
    } catch { }
    await sleep(duration + 250);
  };

  /** Cerrar sesión y redirigir (idempotente) */
  const handleUnauthorized = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      await signOut().catch(() => { });
      await awaitAlert({
        type: 'error',
        title: 'Sesión expirada',
        message: 'Por seguridad, debes iniciar sesión nuevamente.',
        duration: 1500,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
      return await router.replace('/(auth)/auth/login');
    } finally {
      closingRef.current = false;
    }
  }, [router, signOut]);

  /** Oculta modal, sin tocar sesión */
  const hidePrompt = useCallback(() => {
    setVisible(false);
    shownRef.current = false;
    animateTo(0, 150);
  }, [animateTo]);

  /** “Cerrar” manual: bloquea reaperuras, oculta, limpia y cierra sesión */
  const closeAndSignOut = useCallback(async () => {
    suppressRef.current = true; // no abrir de nuevo
    hidePrompt();
    clearIntervalIfAny();
    currentExpRef.current = null;
    await handleUnauthorized();
  }, [handleUnauthorized, hidePrompt]);

  /** Mostrar prompt si procede */
  const showPrompt = useCallback(
    (sec: number) => {
      if (shownRef.current) return;
      if (thresholdSec <= 0) return;
      if (suppressRef.current) return;
      if (closingRef.current) return;
      shownRef.current = true;
      setRemaining(sec);
      setVisible(true);
      animateTo(1, 200);
    },
    [animateTo, thresholdSec]
  );

  /** Extender sesión (refresh) */
  const doExtend = useCallback(async () => {
    try {
      const newToken = await refreshAccessToken();
      if (!newToken) throw new Error('No se pudo renovar el token');

      // Propagar header
      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

      // Reset de controles con el nuevo exp
      const exp = getJwtExp(newToken);
      currentExpRef.current = exp;
      suppressRef.current = false; // permitido volver a alertar en el futuro

      hidePrompt();
      await awaitAlert({
        type: 'success',
        title: 'Sesión extendida',
        message: 'Tu sesión se ha renovado correctamente.',
        duration: 1100,
        logo: require('@/assets/images/pame-logo-t.png'),
      });
    } catch {
      await closeAndSignOut();
    }
  }, [closeAndSignOut, hidePrompt, refreshAccessToken]);

  /** Arranca o rearma el watcher */
  const startWatcher = useCallback(async () => {
    clearIntervalIfAny();

    // Obtiene token y calcula exp actual
    let token: string | null = null;
    try {
      token = await Promise.resolve(getAccessToken());
    } catch {
      token = null;
    }
    const exp = getJwtExp(token);
    currentExpRef.current = exp;
    if (__DEV__) console.log('[SessionWatcher] boot token?', !!token, 'exp=', exp);

    // Si no hay exp válida: nada que vigilar
    if (!exp) return;

    // Si ya expiró: hard-expire
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp <= nowSec) {
      await handleUnauthorized();
      return;
    }

    // Timer 1s
    intervalRef.current = setInterval(async () => {
      if (suppressRef.current || closingRef.current) return;

      // Si perdimos exp (p.ej. token rotó fuera), reintenta cargarla
      if (!currentExpRef.current) {
        let t: string | null = null;
        try {
          t = await Promise.resolve(getAccessToken());
        } catch {
          t = null;
        }
        currentExpRef.current = getJwtExp(t);
        if (!currentExpRef.current) return;
        if (__DEV__) console.log('[SessionWatcher] re-check exp =', currentExpRef.current);
      }

      const now = Math.floor(Date.now() / 1000);
      let diff = currentExpRef.current - now;
      if (diff < 0) diff = 0;

      // Actualiza contador si hay modal
      if (visible) setRemaining((prev) => (prev !== diff ? diff : prev));
      if (__DEV__) console.log('[SessionWatcher] remaining=', diff, 's');

      // Expiró: cerrar sesión sin prompt
      if (diff === 0) {
        suppressRef.current = true;
        hidePrompt();
        clearIntervalIfAny();
        currentExpRef.current = null;
        await handleUnauthorized();
        return;
      }

      // Mostrar prompt si se alcanzó umbral
      if (diff <= thresholdSec && !visible && !shownRef.current) {
        showPrompt(diff);
      }

      // Si se alejó del umbral (alguien renovó fuera), cierra prompt
      if (diff > thresholdSec && shownRef.current) {
        hidePrompt();
      }
    }, 1000) as unknown as number;
  }, [getAccessToken, handleUnauthorized, hidePrompt, showPrompt, thresholdSec, visible]);

  /** Watcher principal */
  useEffect(() => {
    let mounted = true;
    if (!mounted) return;
    startWatcher();
    return () => {
      mounted = false;
      clearIntervalIfAny();
    };
  }, [startWatcher]);

  /** Recalcular al volver de background (cold/warm start) */
  useEffect(() => {
    if (__DEV__) console.log("entro al useEffect");
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      // Al volver al foreground, recalcula exp y re-arma el watcher
      clearIntervalIfAny();
      if (__DEV__) console.log('[SessionWatcher] cleanup');
      shownRef.current = false;
      if (!suppressRef.current) {
        await startWatcher();
      }
    });
    return () => sub.remove();
  }, [startWatcher]);

  const Title = useMemo(
    () => (remaining > 0 ? `Tu sesión expira en ${remaining}s` : 'Sesión expirada'),
    [remaining]
  );

  const bgBackdrop = 'rgba(0,0,0,0.35)';

  return (
    <>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeAndSignOut}
        statusBarTranslucent
      >
        <View
          style={[
            styles.backdrop,
            {
              backgroundColor: bgBackdrop,
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <Animated.View style={[styles.sheet, modalA]}>
            <View style={styles.header}>
              {logo ? (
                <Image source={logo} style={{ width: 36, height: 36, borderRadius: 10, marginRight: 8 }} />
              ) : (
                <MaterialCommunityIcons name="timer-outline" size={28} color="#0f172a" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.title}>{Title}</Text>
            </View>

            <Text style={styles.body}>Tu sesión está por expirar. ¿Quieres mantener la sesión activa?</Text>

            <View style={styles.actions}>
              <Pressable onPress={closeAndSignOut} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: '#0f172a' }]}>Cerrar</Text>
              </Pressable>
              <Pressable onPress={doExtend} style={[styles.btn, styles.btnPrimary]}>
                <Text style={[styles.btnText, { color: '#fff' }]}>Seguir conectado</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '94%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
      default: { boxShadow: '0 20px 40px rgba(0,0,0,.2)' as any },
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  body: { color: '#334155', marginBottom: 14, textAlign: 'left' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { height: 44, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '800' },
  btnGhost: { backgroundColor: '#f1f5f9' },
  btnPrimary: { backgroundColor: '#2563eb' },
});
