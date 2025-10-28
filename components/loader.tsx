 
// components/Loader.tsx
import React from 'react';
import {
    AccessibilityInfo,
    Animated,
    Easing,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from 'react-native';

type LoaderProps = {
  visible?: boolean;
  variant?: 'inline' | 'overlay';
  message?: string;
  size?: number;
  color?: string;
  backdropOpacity?: number;
  blockTouch?: boolean;
  onBackdropPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function Loader({
  visible = false,
  variant = 'inline',
  message,
  size = 36,
  color,
  backdropOpacity = 0.35,
  blockTouch = true,
  onBackdropPress,
  style,
}: LoaderProps) {
  if (!visible) return null;

  const barColor = color ?? (variant === 'overlay' ? '#fff' : '#222');

  if (variant === 'inline') {
    return (
      <View style={[styles.inline, style]} accessible accessibilityRole="progressbar">
        <BarsLoader size={size} color={barColor} />
        {message ? <Text style={styles.inlineText}>{message}</Text> : null}
      </View>
    );
  }

  // overlay
  const Backdrop: any = blockTouch ? Pressable : View;
  return (
    <View
      style={[styles.overlayRoot, style]}
      pointerEvents="box-none"
      accessibilityViewIsModal
      accessible
      accessibilityRole="progressbar"
      onLayout={() => AccessibilityInfo.announceForAccessibility?.(message ?? 'Cargando')}
    >
      <Backdrop
        style={[styles.backdrop, { backgroundColor: `rgba(0,0,0,${backdropOpacity})` }]}
        onPress={onBackdropPress}
        pointerEvents={blockTouch ? 'auto' : 'none'}
      >
        <View />
      </Backdrop>

      <View style={styles.overlayContent} pointerEvents="none">
        <View style={styles.loaderCard} pointerEvents="none">
          <BarsLoader size={size * 1.2} color={barColor} />
          {message ? <Text style={styles.overlayText}>{message}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/** ====== Loader de 4 barras con Animated (RN) ====== */
function BarsLoader({ size = 36, color = '#fff' }: { size?: number; color?: string }) {
  // Geometría
  const height = Math.max(24, size);
  const barMax = Math.round(height * 0.72);
  const barMin = Math.max(6, Math.round(barMax * 0.28));
  const barWidth = Math.max(3, Math.round(height * 0.14));
  const gap = Math.max(4, Math.round(barWidth * 0.7));

  // 4 drivers con desfases
  const v0 = React.useRef(new Animated.Value(0)).current;
  const v1 = React.useRef(new Animated.Value(0)).current;
  const v2 = React.useRef(new Animated.Value(0)).current;
  const v3 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false, // animamos height
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      );

    const a0 = mk(v0, 0);
    const a1 = mk(v1, 120);
    const a2 = mk(v2, 240);
    const a3 = mk(v3, 360);

    a0.start(); a1.start(); a2.start(); a3.start();
    return () => { a0.stop(); a1.stop(); a2.stop(); a3.stop(); };
  }, [v0, v1, v2, v3]);

  const h0 = v0.interpolate({ inputRange: [0, 1], outputRange: [barMin, barMax] });
  const h1 = v1.interpolate({ inputRange: [0, 1], outputRange: [barMin, barMax] });
  const h2 = v2.interpolate({ inputRange: [0, 1], outputRange: [barMin, barMax] });
  const h3 = v3.interpolate({ inputRange: [0, 1], outputRange: [barMin, barMax] });

  return (
    <View style={[styles.barsWrap, { height }]}>
      <Animated.View style={[styles.bar, { width: barWidth, height: h0, backgroundColor: color }]} />
      <View style={{ width: gap }} />
      <Animated.View style={[styles.bar, { width: barWidth, height: h1, backgroundColor: color }]} />
      <View style={{ width: gap }} />
      <Animated.View style={[styles.bar, { width: barWidth, height: h2, backgroundColor: color }]} />
      <View style={{ width: gap }} />
      <Animated.View style={[styles.bar, { width: barWidth, height: h3, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Inline
  inline: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  inlineText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#444',
  },

  // Overlay
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCard: {
    minWidth: 140,
    maxWidth: '80%',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  overlayText: {
    marginTop: 10,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },

  // Barras
  barsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 6,
  },
});
