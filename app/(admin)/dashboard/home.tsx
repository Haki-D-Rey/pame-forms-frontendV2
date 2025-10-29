// app/(admin)/dashboard/home.tsx
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

type StatItem = {
  id: string;
  edificio: string;
  diarios: number;
  mensuales: number;
  supervisor: string;
  tendencia: number; // -1 a 1
};

const SAMPLE: StatItem[] = [
  { id: 'E01', edificio: 'Torre A', diarios: 42, mensuales: 812, supervisor: 'M. Gómez', tendencia: 0.18 },
  { id: 'E02', edificio: 'Torre B', diarios: 33, mensuales: 690, supervisor: 'L. Ruiz',  tendencia: -0.05 },
  { id: 'E03', edificio: 'Emergencias', diarios: 57, mensuales: 1032, supervisor: 'K. López', tendencia: 0.27 },
  { id: 'E04', edificio: 'Laboratorios', diarios: 21, mensuales: 402, supervisor: 'J. Ortega', tendencia: 0.04 },
  { id: 'E05', edificio: 'Imagenología', diarios: 29, mensuales: 535, supervisor: 'A. Méndez', tendencia: 0.10 },
  { id: 'E06', edificio: 'Farmacia', diarios: 48, mensuales: 950, supervisor: 'S. Pérez', tendencia: 0.22 },
];

export default function HomeScreen() {
  // ===== tokens de tema =====
  const text    = useThemeColor({}, 'text');
  const tint    = useThemeColor({}, 'tint');
  const bg      = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const border  = useThemeColor({}, 'border');
  const muted   = useThemeColor({}, 'muted');
  const fieldBg = useThemeColor({}, 'fieldBg');

  const { width } = useWindowDimensions();
  const cardWidth = Math.max(260, Math.min(360, width * 0.7));

  const styles = useMemo(
    () => createStyles({ text, tint, bg, surface, border, muted, fieldBg }),
    [text, tint, bg, surface, border, muted, fieldBg]
  );

  const top = useMemo(
    () => [...SAMPLE].sort((a, b) => b.mensuales - a.mensuales)[0],
    []
  );

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      {/* Header compacto */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: text }]}>Dashboard · Home</Text>
        <Text style={[styles.subtitle, { color: text, opacity: 0.7 }]}>
          Bienvenido — vista general de formularios por edificio
        </Text>
      </View>

      {/* Resumen superior */}
      <View style={styles.kpisRow}>
        <KpiPill label="Total diarios" value={SAMPLE.reduce((a, b) => a + b.diarios, 0)} styles={styles} />
        <KpiPill label="Total mensuales" value={SAMPLE.reduce((a, b) => a + b.mensuales, 0)} styles={styles} />
        <KpiPill
          label="Top supervisor"
          value={`${top.supervisor} • ${top.mensuales}`}
          small
          styles={styles}
        />
      </View>

      {/* Carrusel infinito */}
      <AutoCarousel
        data={SAMPLE}
        cardWidth={cardWidth}
        gap={12}
        speed={28}
        intervalMs={40}
        styles={styles}
      />
    </View>
  );
}

/** ─────────────────────────  Carousel infinito con pausa  ───────────────────────── */
function AutoCarousel({
  data,
  cardWidth = 320,
  gap = 12,
  speed = 24,
  intervalMs = 40,
  styles,
}: {
  data: StatItem[];
  cardWidth?: number;
  gap?: number;
  speed?: number;
  intervalMs?: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const listRef = useRef<ScrollView>(null);
  const [paused, setPaused] = useState(false);
  const offsetRef = useRef(0);

  // Duplicamos para efecto infinito
  const loopData = useMemo(() => [...data, ...data], [data]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (paused || !listRef.current) return;
      offsetRef.current += speed;
      const loopWidth = (cardWidth + gap) * data.length;
      if (offsetRef.current >= loopWidth) {
        offsetRef.current -= loopWidth;
        listRef.current?.scrollTo({ x: offsetRef.current, animated: false });
      } else {
        listRef.current?.scrollTo({ x: offsetRef.current, animated: true });
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [paused, data.length, speed, intervalMs, cardWidth, gap]);

  const onMouseEnter = () => Platform.OS === 'web' && setPaused(true);
  const onMouseLeave = () => Platform.OS === 'web' && setPaused(false);

  return (
    <View
      style={styles.carouselWrap}
      // @ts-ignore RN Web
      onMouseEnter={onMouseEnter}
      // @ts-ignore RN Web
      onMouseLeave={onMouseLeave}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <ScrollView
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 6 }}
      >
        {loopData.map((item, i) => (
          <StatCard key={`${item.id}-${i}`} item={item} w={cardWidth} gap={gap} styles={styles} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Tarjeta con micro-animación (hover/press = scale) */
function StatCard({
  item,
  w,
  gap,
  styles,
}: {
  item: StatItem;
  w: number;
  gap: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const bumpIn = () =>
    Animated.timing(scale, {
      toValue: 1.02,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const bumpOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 120,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();

  const trendColor =
    item.tendencia > 0 ? styles.colors.success :
    item.tendencia < 0 ? styles.colors.danger  :
    styles.colors.muted;
  const trendIcon = item.tendencia > 0 ? '▲' : item.tendencia < 0 ? '▼' : '■';
  const trendPct = Math.round(item.tendencia * 100);

  return (
    <Pressable
      style={{ marginRight: gap }}
      onPressIn={bumpIn}
      onPressOut={bumpOut}
      // @ts-ignore RN Web
      onMouseEnter={bumpIn}
      // @ts-ignore RN Web
      onMouseLeave={bumpOut}
    >
      <Animated.View
        style={[
          styles.card,
          {
            width: w,
            transform: [{ scale }],
            borderColor: styles.colors.border,
            backgroundColor: styles.colors.surface,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: styles.colors.text }]} numberOfLines={1}>
            {item.edificio}
          </Text>
          <View style={[styles.badge, { backgroundColor: styles.colors.tintSoft, borderColor: styles.colors.tintBorder }]}>
            <Text style={{ color: styles.colors.tint, fontWeight: '700', fontSize: 11 }}>Formularios</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Metric label="Diarios" value={item.diarios} styles={styles} />
          <Metric label="Mensuales" value={item.mensuales} styles={styles} />
          <View style={styles.trendBox}>
            <Text style={{ color: trendColor, fontWeight: '800', fontSize: 12 }}>
              {trendIcon} {Math.abs(trendPct)}%
            </Text>
            <Text style={{ color: styles.colors.muted, fontSize: 11, marginTop: 2 }}>Tendencia</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={{ color: styles.colors.mutedAlt, fontSize: 11 }}>Supervisor</Text>
          <Text style={{ color: styles.colors.text, fontWeight: '700', fontSize: 13 }}>
            {item.supervisor}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function Metric({ label, value, styles }: { label: string; value: number | string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.metric}>
      <Text style={{ color: styles.colors.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: styles.colors.emphasis, fontSize: 18, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function KpiPill({
  label,
  value,
  small,
  styles,
}: {
  label: string;
  value: number | string;
  small?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.kpi, small && { paddingVertical: 6, paddingHorizontal: 10 }]}>
      <Text style={{ color: styles.colors.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: styles.colors.emphasis, fontSize: small ? 13 : 15, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

/* ─────────────────────────────────  styles  ───────────────────────────────── */
function createStyles(c: {
  text: string;
  tint: string;
  bg: string;
  surface: string;
  border: string;
  muted: string;
  fieldBg: string;
}) {
  // helpers de alpha sobre el tint
  const tintSoft = `${c.tint}1A`;   // ~10% alpha
  const tintBorder = `${c.tint}66`; // ~40% alpha

  return StyleSheet.create({
    // paleta expuesta para usar en subcomponentes
    colors: {
      text: c.text,
      bg: c.bg,
      surface: c.surface,
      border: c.border,
      muted: c.muted,
      mutedAlt: c.muted,     // alias
      emphasis: c.text,      // números/títulos
      tint: c.tint,
      tintSoft,
      tintBorder,
      success: '#10b981',
      danger: '#ef4444',
      tileBg: c.fieldBg,     // cajas de métricas
    } as any,

    wrap: { flex: 1, padding: 12 },
    headerRow: { marginBottom: 8 },
    title: { fontSize: 18, fontWeight: '800' },
    subtitle: { marginTop: 2, fontSize: 12 },

    kpisRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    kpi: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: c.surface,
    },

    carouselWrap: {
      height: 180,
      borderRadius: 16,
    },

    card: {
      height: 170,
      borderRadius: 16,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
        android: { elevation: 4 },
        default: { boxShadow: '0 10px 24px rgba(0,0,0,0.08)' as any },
      }),
    },
    cardHeader: {
      height: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    cardTitle: { fontSize: 14, fontWeight: '800' },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    metric: {
      width: 96,
      height: 72,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.fieldBg,
      padding: 8,
      justifyContent: 'center',
    },
    trendBox: {
      flex: 1,
      height: 72,
      marginLeft: 8,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.fieldBg,
      padding: 8,
      justifyContent: 'center',
    },

    footerRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
  });
}
