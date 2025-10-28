// src/components/GlobalAlert.tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    EmitterSubscription,
    Image,
    ImageSourcePropType,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AlertType = 'success' | 'error';
export type ShowAlertParams = {
  type?: AlertType;
  title?: string;
  message: string;
  duration?: number;       // ms; si se omite, no autocierra
  logo?: ImageSourcePropType;
};

type Ctx = {
  show: (p: ShowAlertParams) => void;
  success: (msg: string, opts?: Omit<ShowAlertParams, 'message' | 'type'>) => void;
  error: (msg: string, opts?: Omit<ShowAlertParams, 'message' | 'type'>) => void;
  hide: () => void;
};

const AlertCtx = createContext<Ctx | null>(null);
export const useGlobalAlert = () => {
  const ctx = useContext(AlertCtx);
  if (!ctx) throw new Error('useGlobalAlert debe usarse dentro de <GlobalAlertProvider />');
  return ctx;
};

export function GlobalAlertProvider({
  children,
  logoDefault,
}: {
  children: React.ReactNode;
  logoDefault?: ImageSourcePropType;
}) {
  const insets = useSafeAreaInsets();

  // contenido
  const [type, setType] = useState<AlertType>('success');
  const [title, setTitle] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [logo, setLogo] = useState<ImageSourcePropType | undefined>(logoDefault);

  // visibilidad / interacción
  const [interactive, setInteractive] = useState(false); // pointer events
  const [gone, setGone] = useState(true);                // display: none cuando está oculto

  // animación (RN Animated)
  const open = useRef(new Animated.Value(0)).current;          // 0 oculto, 1 visible
  const translateY = open.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });
  const opacity = open; // mismo valor

  // progreso
  const progress = useRef(new Animated.Value(0)).current;      // 0..1
  const [trackWidth, setTrackWidth] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null | number>(null);
  const closingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimer();
    setInteractive(false); // desactiva clicks durante el cierre

    Animated.timing(open, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setGone(true);
      closingRef.current = false;
    });

    // barra a 0 (sin driver nativo porque animamos width en px)
    progress.stopAnimation();
    progress.setValue(0);
  }, [open, progress]);

  const show = useCallback((p: ShowAlertParams) => {
    clearTimer();
    closingRef.current = false;

    setType(p.type ?? 'success');
    setTitle(p.title);
    setMessage(p.message);
    setLogo(p.logo ?? logoDefault);

    // vuelve a incluir en layout y permite interacción
    setGone(false);
    setInteractive(true);

    // abre
    Animated.timing(open, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
      AccessibilityInfo.announceForAccessibility?.(p.title ? `${p.title}. ${p.message}` : p.message);
    });

    // progreso si hay duración
    progress.stopAnimation();
    progress.setValue(0);

    if (p.duration && p.duration > 0) {
      Animated.timing(progress, { toValue: 1, duration: p.duration, useNativeDriver: false }).start();
      timerRef.current = setTimeout(() => hide(), p.duration);
    }
  }, [hide, logoDefault, open, progress]);

  const success = useCallback((msg: string, opts?: Omit<ShowAlertParams, 'message' | 'type'>) => {
    show({ type: 'success', message: msg, ...opts });
  }, [show]);

  const error = useCallback((msg: string, opts?: Omit<ShowAlertParams, 'message' | 'type'>) => {
    show({ type: 'error', message: msg, ...opts });
  }, [show]);

  // limpiar si desmonta el provider
  React.useEffect(() => () => clearTimer(), []);

  const ctxValue = useMemo<Ctx>(() => ({ show, success, error, hide }), [show, success, error, hide]);

  const theme = type === 'success'
    ? { bg: '#EAF6EE', border: '#A7F3D0', icon: '#16A34A', progress: '#22C55E', title: '#065F46', text: '#0F172A' }
    : { bg: '#FEECEC', border: '#FCA5A5', icon: '#DC2626', progress: '#EF4444', title: '#7F1D1D', text: '#0F172A' };

  // estilos animados
  const containerAStyle = {
    opacity,
    transform: [{ translateY }],
  } as const;

  const [cardHasShadow, setCardHasShadow] = useState(false);
  React.useEffect(() => {
    let sub: EmitterSubscription | undefined | string;
    // cambia sombra según "open" sin reanimated
    sub = open.addListener(({ value }) => setCardHasShadow(value > 0.01));
    return () => {
      if (sub) open.removeListener(sub);
    };
  }, [open]);

  const cardShadowStyle =
    Platform.OS === 'android'
      ? { elevation: cardHasShadow ? 6 : 0 }
      : { shadowOpacity: cardHasShadow ? 0.12 : 0 };

  // width en px de la barra de progreso
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, trackWidth)],
    extrapolate: 'clamp',
  });

  return (
    <AlertCtx.Provider value={ctxValue}>
      {children}

      {/* Siempre montado, pero cuando gone=true no ocupa layout ni dibuja sombra */}
      <Animated.View
        style={[
          styles.wrap,
          containerAStyle,
          { paddingTop: insets.top + 8, display: gone ? ('none' as const) : ('flex' as const) },
        ]}
        pointerEvents={interactive ? 'box-none' : 'none'}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.bg, borderColor: theme.border },
            cardShadowStyle,
            Platform.OS === 'web' ? ({ boxShadow: cardHasShadow ? '0 10px 22px rgba(0,0,0,0.10)' : 'none' } as any) : null,
          ]}
        >
          <View style={styles.leading}>
            {logo
              ? <Image source={logo} style={styles.logo} resizeMode="contain" />
              : <MaterialCommunityIcons name={type === 'success' ? 'check-circle-outline' : 'close-circle-outline'} size={24} color={theme.icon} />
            }
          </View>

          <View style={{ flex: 1 }}>
            {title ? <Text style={[styles.title, { color: theme.title }]} numberOfLines={1}>{title}</Text> : null}
            <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>{message}</Text>
          </View>

          <Pressable onPress={hide} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar alerta">
            <MaterialCommunityIcons name="close" size={18} color="#475569" />
          </Pressable>

          <View
            style={styles.progressTrack}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View style={[styles.progressFill, { backgroundColor: theme.progress, width: progressWidth }]} />
          </View>
        </View>
      </Animated.View>
    </AlertCtx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    width: '94%',
    maxWidth: 640,
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: { width: 28, height: 28, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 24, height: 24, borderRadius: 6 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  message: { fontSize: 13 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  progressTrack: {
    position: 'absolute',
    left: 10, right: 10, bottom: 8,
    height: 3, borderRadius: 999, overflow: 'hidden',
    backgroundColor: '#00000012',
  },
  progressFill: { height: '100%' },
});
