// components/admin/AdminShell.tsx
import { useGlobalAlert } from '@/components/global-alert-component';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/providers/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Easing,
  Image,
  InteractionManager,
  Platform,
  Pressable,
  Animated as RNAnimated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = { children: React.ReactNode };

const NAV = [
  {
    section: 'Dashboard',
    items: [
      { label: 'Inicio', icon: 'home-outline', href: '/(admin)/dashboard/home' },
      { label: 'Formulario', icon: 'file-document-edit-outline', href: '/(admin)/dashboard/form' },
      { label: 'Reportes', icon: 'chart-box-outline', href: '/(admin)/dashboard/reporte' },
    ],
  },
  {
    section: 'Security',
    items: [
      { label: 'Usuarios', icon: 'account-multiple-outline', href: '/(admin)/security/users' },
      { label: 'Roles', icon: 'shield-account-outline', href: '/(admin)/security/roles' },
      { label: 'Permisos', icon: 'key-outline', href: '/(admin)/security/permissions' },
    ],
  },
] as const;

const RAIL_W = 272;
const DRAWER_W = 300;
const HEADER_H = 56;

const CONTENT_ENTER_Y = 6;
const CONTENT_FADE_IN_MS = 120;
const CONTENT_SLIDE_IN_MS = 160;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AdminShell({ children }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= 768;

  const router = useRouter();
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  // ===== Tokens de tema centralizados =====
  const text = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const muted = useThemeColor({}, 'muted');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const fieldBg = useThemeColor({}, 'fieldBg');
  const fieldBorder = useThemeColor({}, 'fieldBorder');
  const tint = useThemeColor({}, 'tint');

  // Sólo para StatusBar (puedes cambiarlo a un token si prefieres)
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const styles = useMemo(
    () => createStyles({ text, bg, primary, muted, surface, border, fieldBg, fieldBorder, tint }),
    [text, bg, primary, muted, surface, border, fieldBg, fieldBorder, tint]
  );

  // Ripple helper
  const ripple = (c: string) => (Platform.OS === 'android' ? { android_ripple: { color: c } } : {});

  const [open, setOpen] = useState(false);
  const [footerH, setFooterH] = useState(0);
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

  // Drawer (RN Animated)
  const animX = useRef(new RNAnimated.Value(-DRAWER_W)).current;
  const backdrop = animX.interpolate({
    inputRange: [-DRAWER_W, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const topOffset = HEADER_H + insets.top;

  const springTo = (toValue: number) =>
    RNAnimated.spring(animX, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    });

  const showSidebar = () => {
    setOpen(true);
    springTo(0).start();
  };
  const hideSidebar = (cb?: () => void) => {
    springTo(-DRAWER_W).start(({ finished }) => {
      if (finished) {
        setOpen(false);
        cb?.();
      }
    });
  };
  const toggleSidebar = () => (open ? hideSidebar() : showSidebar());

  // ruta sin grupos /(xxx)
  const stripGroups = (p: string = '') => p.replace(/\/\([^/]+\)/g, '');
  const currentPath = stripGroups(pathname ?? '');

  const isActive = (href: string) => {
    const target = stripGroups(href);
    return currentPath === target || currentPath.startsWith(target + '/');
  };

  const navigateFromMenu = (href: string) => {
    if (isMd) router.replace(href as any);
    else hideSidebar(() => router.replace(href as any));
  };

  const contentMarginLeft = isMd ? RAIL_W : 0;

  // Anim del contenido (sin reanimated)
  const contentOpacity = useRef(new RNAnimated.Value(1)).current;
  const contentTranslateY = useRef(new RNAnimated.Value(0)).current;
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      contentOpacity.setValue(1);
      contentTranslateY.setValue(0);
      return;
    }
    setLoading(true);
    contentOpacity.setValue(0);
    contentTranslateY.setValue(CONTENT_ENTER_Y);
    RNAnimated.parallel([
      RNAnimated.timing(contentOpacity, {
        toValue: 1,
        duration: CONTENT_FADE_IN_MS,
        useNativeDriver: true,
      }),
      RNAnimated.timing(contentTranslateY, {
        toValue: 0,
        duration: CONTENT_SLIDE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      InteractionManager.runAfterInteractions(() => setLoading(false));
    });
  }, [currentPath]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Fondo */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />

      {/* StatusBar acorde a tema */}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header fijo */}
      <View
        style={[
          styles.header,
          {
            height: HEADER_H + insets.top,
            paddingTop: insets.top,
            backgroundColor: surface,
            borderColor: border,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={isMd ? undefined : toggleSidebar}
          style={[styles.iconBtn, { padding: 2 }]}
          accessibilityRole="button"
          {...ripple(`${text}14`)}
        >
          {!isMd && <MaterialCommunityIcons name="menu" size={28} color={text} />}
        </Pressable>

        <View style={styles.brandWrap}>
          <Image
            source={require('@/assets/images/pame-logo-t.png')}
            style={{ width: 22, height: 22, marginRight: 8 }}
            resizeMode="contain"
          />
          <Text style={[styles.brand, { color: text }]}>Pame Admin</Text>
        </View>

        <View style={styles.actionsRight}>
          <Pressable style={styles.actionPill} accessibilityRole="button" {...ripple(`${text}12`)}>
            <MaterialCommunityIcons name="bell-outline" size={18} color={text} />
          </Pressable>
          <Pressable style={[styles.actionPill, { marginLeft: 6 }]} accessibilityRole="button" {...ripple(`${text}12`)}>
            <MaterialCommunityIcons name="account-circle-outline" size={20} color={text} />
          </Pressable>
        </View>
      </View>

      {/* MAIN ABSOLUTO */}
      <RNAnimated.View
        style={[
          styles.mainAbs,
          {
            top: topOffset,
            left: contentMarginLeft,
            paddingBottom: footerH + insets.bottom,
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
        renderToHardwareTextureAndroid
        collapsable={false}
      >
        <View style={styles.content}>{children}</View>
      </RNAnimated.View>

      {/* Rail desktop */}
      {isMd && (
        <View
          style={[
            styles.rail,
            {
              top: topOffset,
              width: RAIL_W,
              backgroundColor: surface,
              borderRightColor: border,
            },
          ]}
          pointerEvents="auto"
        >
          <View style={{ flex: 1, minHeight: 0 }}>
            <SidebarContent
              tokens={{ text, tint, primary, muted, border, fieldBg, surface }}
              isActive={isActive}
              onNavigate={navigateFromMenu}
              userEmail={user?.email}
              ripple={ripple}
              onSignOut={async () => {
                await signOut();
                router.replace('/(auth)/auth/login' as const);
              }}
              stylesGlobal={styles}
            />
          </View>
        </View>
      )}

      {/* Drawer mobile */}
      {!isMd && (
        <>
          {open && (
            <RNAnimated.View
              pointerEvents="auto"
              style={[styles.backdrop, { top: topOffset, opacity: backdrop, zIndex: 30 }]}
            >
              <Pressable onPress={() => hideSidebar()} style={StyleSheet.absoluteFill} {...ripple('#00000033')} />
            </RNAnimated.View>
          )}

          <RNAnimated.View
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              styles.drawer,
              {
                top: topOffset,
                width: DRAWER_W,
                transform: [{ translateX: animX }],
                backgroundColor: surface,
                borderRightColor: border,
                zIndex: 31,
              },
            ]}
          >
            <View style={{ flex: 1, minHeight: 0 }}>
              <View style={[styles.drawerHeader, { flexShrink: 0, borderBottomColor: border }]}>
                <View style={styles.logoRow}>
                  <Image
                    source={require('@/assets/images/pame-logo-t.png')}
                    style={{ width: 22, height: 22, marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text style={[styles.sidebarTitle, { color: text }]}>Pame Admin</Text>
                </View>
                <Pressable onPress={() => hideSidebar()} style={styles.iconBtn} accessibilityRole="button" {...ripple(`${text}12`)}>
                  <MaterialCommunityIcons name="close" size={20} color={text} />
                </Pressable>
              </View>

              <View style={{ flex: 1, minHeight: 0 }}>
                <SidebarContent
                  tokens={{ text, tint, primary, muted, border, fieldBg, surface }}
                  isActive={isActive}
                  onNavigate={navigateFromMenu}
                  userEmail={user?.email}
                  ripple={ripple}
                  onSignOut={async () => {
                    await signOut();
                    await awaitAlert({
                      type: 'error',
                      title: 'Sesion Terminada',
                      message: 'Saliendo del Panel Corporativo',
                      duration: 1500,
                      logo: require('@/assets/images/pame-logo-t.png'),
                    });
                    await sleep(1000);
                    router.replace('/(auth)/auth/login' as const);
                  }}
                  stylesGlobal={styles}
                />
              </View>
            </View>
          </RNAnimated.View>
        </>
      )}

      {/* Footer medible (placeholder si lo agregas luego) */}
      <View onLayout={() => setFooterH(0)} style={{ height: 0 }} />
    </SafeAreaView>
  );
}

function SidebarContent({
  tokens,
  isActive,
  onNavigate,
  userEmail,
  onSignOut,
  ripple,
  stylesGlobal,
}: {
  tokens: {
    text: string; tint: string; primary: string; muted: string;
    border: string; fieldBg: string; surface: string;
  };
  isActive: (href: string) => boolean;
  onNavigate: (href: string) => void;
  userEmail?: string | null;
  onSignOut: () => Promise<void>;
  ripple: (c: string) => any;
  stylesGlobal?: ReturnType<typeof createStyles>;
}) {
  const { text, tint, primary, muted, border, fieldBg, surface } = tokens;
  const styles = stylesGlobal ?? createStyles({ text, bg: surface, primary, muted, surface, border, fieldBg, fieldBorder: border, tint });

  // Fondos derivados SOLO de tokens (no useColorScheme), para que sigan el tema activo de la app
  const sectionBg = surface;
  const itemBg = surface;

  const avatarLetter = useMemo(() => (userEmail ? userEmail[0].toUpperCase() : 'U'), [userEmail]);
  const initialExpanded = useMemo(
    () => NAV.reduce((acc, sec) => ((acc[sec.section] = true), acc), {} as Record<string, boolean>),
    []
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(initialExpanded);

  return (
    <View style={styles.sidebarContentWrap}>
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {NAV.map((sec) => {
          const anyActive = sec.items.some((it) => isActive(it.href));
          const open = expanded[sec.section] ?? true;
          return (
            <View key={sec.section} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() => setExpanded((p) => ({ ...p, [sec.section]: !open }))}
                style={[
                  styles.sectionHeader,
                  { backgroundColor: sectionBg, borderColor: border },
                  anyActive && { backgroundColor: `${tint}10`, borderColor: `${tint}55` },
                ]}
                accessibilityRole="button"
                {...ripple(`${text}12`)}
              >
                <View style={[styles.leftAccent, { backgroundColor: anyActive ? tint : border }]} />
                <Text style={[styles.sectionTitle, { color: text }]} numberOfLines={1}>
                  {sec.section}
                </Text>
                <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={text} />
              </Pressable>

              {open &&
                sec.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Pressable
                      key={item.href}
                      onPress={() => onNavigate(item.href)}
                      style={({ pressed }) => [
                        styles.navItem,
                        { backgroundColor: itemBg, borderColor: 'transparent' },
                        active && { backgroundColor: `${tint}14`, borderColor: `${tint}55` },
                        pressed && { opacity: 0.9 },
                      ]}
                      accessibilityRole="button"
                      {...ripple(`${text}10`)}
                    >
                      <View style={[styles.itemLeftMarker, active && { backgroundColor: tint }]} />
                      <View style={styles.iconCell}>
                        <MaterialCommunityIcons name={item.icon as any} size={20} color={active ? tint : text} />
                      </View>
                      <Text style={[styles.navLabel, { color: active ? tint : text }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.sidebarFooter, { borderTopColor: border, paddingVertical: 10 }]}>
        {/* Izquierda: Avatar + info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <View style={[styles.avatar, { backgroundColor: tint }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{avatarLetter}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: text }} numberOfLines={1} ellipsizeMode="tail">
              {userEmail ?? 'user@hospitalmilitar.com.ni'}
            </Text>
            <Text style={{ fontSize: 11, color: muted }} numberOfLines={1} ellipsizeMode="tail">
              Sesión activa
            </Text>
          </View>
        </View>

        {/* Derecha: botón pill cerrar sesión */}
        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 0,
              paddingHorizontal: 8,
              paddingVertical: 8,
              borderRadius: 5,
              backgroundColor: 'rgba(239,68,68,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(254,202,202,0.6)',
            },
            pressed && { opacity: 0.9 },
          ]}
          {...ripple('#00000022')}
        >
          <MaterialCommunityIcons name="logout-variant" size={16} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(c: {
  text: string; bg: string; primary: string; muted: string; surface: string; border: string; fieldBg: string; fieldBorder: string; tint: string;
}) {
  return StyleSheet.create({
    safe: { flex: 1 },

    header: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 40,
    },

    // Contenedor principal absoluto del main
    mainAbs: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      padding: 12,
      zIndex: 10,
    },

    content: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
    },

    actionsRight: { flexDirection: 'row', alignItems: 'center' },
    actionPill: { height: 34, width: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    iconBtn: { height: 34, width: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    brandWrap: { flexDirection: 'row', alignItems: 'center' },
    brand: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

    rail: {
      position: 'absolute',
      left: 0, bottom: 0,
      borderRightWidth: StyleSheet.hairlineWidth,
      flexDirection: 'column',
      minHeight: 0,
      zIndex: 30,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
        android: { elevation: 6 },
        default: {},
      }),
    },

    drawer: {
      position: 'absolute',
      left: 0, bottom: 0,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderTopRightRadius: 16,
      flexDirection: 'column',
      minHeight: 0,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
        android: { elevation: 12 },
        default: {},
      }),
    },

    drawerHeader: {
      height: 52,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
    },

    backdrop: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      backgroundColor: '#0f172a99',
    },

    logoRow: { flexDirection: 'row', alignItems: 'center' },
    sidebarTitle: { fontSize: 15, fontWeight: '800' },

    sidebarContentWrap: { flex: 1, minHeight: 0 },

    navItem: {
      height: 46, minHeight: 46, maxHeight: 46,
      position: 'relative',
      borderRadius: 12,
      paddingRight: 12, paddingLeft: 12,
      alignItems: 'center', flexDirection: 'row',
      marginBottom: 6,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    iconCell: { width: 28, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    navLabel: { fontSize: 15, fontWeight: '600' },

    sidebarFooter: {
      paddingHorizontal: 12, paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center',
    },
    avatar: {
      width: 32, height: 32, borderRadius: 999,
      alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },

    sectionHeader: {
      height: 36, borderRadius: 12, paddingHorizontal: 10,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 6,
    },
    sectionTitle: {
      flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
      textTransform: 'uppercase', opacity: 0.9,
    },
    leftAccent: {
      width: 4, height: 18, borderRadius: 3, marginRight: 8,
    },
    itemLeftMarker: {
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
      borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
      backgroundColor: 'transparent',
    },
  });
}
