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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = { children: React.ReactNode };

const NAV = [
  {
    section: 'Dashboard',
    items: [
      { label: 'Home', icon: 'home-outline', href: '/(admin)/dashboard/home' },
      { label: 'Formulario', icon: 'file-document-edit-outline', href: '/(admin)/dashboard/form' },
      { label: 'Reportes', icon: 'chart-box-outline', href: '/(admin)/dashboard/reporte' },
    ],
  },
  {
    section: 'Security',
    items: [
      { label: 'Users', icon: 'account-multiple-outline', href: '/(admin)/security/users' },
      { label: 'Roles', icon: 'shield-account-outline', href: '/(admin)/security/roles' },
      { label: 'Permissions', icon: 'key-outline', href: '/(admin)/security/permissions' },
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

  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');

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

      <StatusBar barStyle={Platform.OS === 'android' ? 'light-content' : 'dark-content'} />

      {/* Header fijo */}
      <View
        style={[
          styles.header,
          {
            height: HEADER_H + insets.top,
            paddingTop: insets.top,
            borderColor: '#00000012',
            backgroundColor: bg,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={isMd ? undefined : toggleSidebar}
          style={[styles.iconBtn, { padding: 2 }]}
          accessibilityRole="button"
          {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000014' } } : {})}
        >
          {!isMd && <MaterialCommunityIcons name="menu" size={28} color={text} />}
        </Pressable>

        <View style={styles.brandWrap}>
          <Image source={require('@/assets/images/pame-logo-t.png')} style={{ width: 22, height: 22, marginRight: 8 }} resizeMode="contain" />
          <Text style={[styles.brand, { color: text }]}>Pame Admin</Text>
        </View>

        <View style={styles.actionsRight}>
          <Pressable style={styles.actionPill} accessibilityRole="button" {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000010' } } : {})}>
            <MaterialCommunityIcons name="bell-outline" size={18} color={text} />
          </Pressable>
          <Pressable style={[styles.actionPill, { marginLeft: 6 }]} accessibilityRole="button" {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000010' } } : {})}>
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
              backgroundColor: Platform.select({
                ios: 'rgba(250,250,250,1)',
                android: 'rgba(250,250,250,1)',
                default: 'rgba(250,250,250,0.98)',
              }),
            },
          ]}
          pointerEvents="auto"
        >
          <View style={{ flex: 1, minHeight: 0 }}>
            <SidebarContent
              text={text}
              tint={tint}
              isActive={isActive}
              onNavigate={navigateFromMenu}
              userEmail={user?.email}
              onSignOut={async () => {
                await signOut();
                router.replace('/auth/login' as const);
              }}
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
              <Pressable
                onPress={() => hideSidebar()}
                style={StyleSheet.absoluteFill}
                {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000033' } } : {})}
              />
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
                backgroundColor: Platform.select({
                  ios: 'rgba(250,250,250,1)',
                  android: 'rgba(250,250,250,1)',
                  default: 'rgba(255,255,255,0.98)',
                }),
                zIndex: 31,
              },
            ]}
          >
            <View style={{ flex: 1, minHeight: 0 }}>
              <View style={[styles.drawerHeader, { flexShrink: 0 }]}>
                <View style={styles.logoRow}>
                  <Image source={require('@/assets/images/pame-logo-t.png')} style={{ width: 22, height: 22, marginRight: 8 }} resizeMode="contain" />
                  <Text style={[styles.sidebarTitle, { color: text }]}>Pame Admin</Text>
                </View>
                <Pressable onPress={() => hideSidebar()} style={styles.iconBtn} accessibilityRole="button" {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000010' } } : {})}>
                  <MaterialCommunityIcons name="close" size={20} color={text} />
                </Pressable>
              </View>

              <View style={{ flex: 1, minHeight: 0 }}>
                <SidebarContent
                  text={text}
                  tint={tint}
                  isActive={isActive}
                  onNavigate={navigateFromMenu}
                  userEmail={user?.email}
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
                    router.replace('/auth/login' as const);
                  }}
                />
              </View>
            </View>
          </RNAnimated.View>
        </>
      )}

      {/* Footer medible (si lo agregas luego) */}
      <View onLayout={() => setFooterH(0)} style={{ height: 0 }} />
    </SafeAreaView>
  );
}

function SidebarContent({
  text,
  tint,
  isActive,
  onNavigate,
  userEmail,
  onSignOut,
}: {
  text: string;
  tint: string;
  isActive: (href: string) => boolean;
  onNavigate: (href: string) => void;
  userEmail?: string | null;
  onSignOut: () => Promise<void>;
}) {
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
                  anyActive && { backgroundColor: `${tint}10`, borderColor: `${tint}55` },
                ]}
                accessibilityRole="button"
                {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000014' } } : {})}
              >
                <View style={[styles.leftAccent, anyActive && { backgroundColor: tint, opacity: 0.9 }]} />
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
                        active && { backgroundColor: `${tint}14`, borderColor: `${tint}55` },
                        pressed && { opacity: 0.9 },
                      ]}
                      accessibilityRole="button"
                      {...(Platform.OS === 'android' ? { android_ripple: { color: '#00000010' } } : {})}
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

      <View style={[styles.sidebarFooter, { borderTopColor: '#00000010' }]}>
        <View style={styles.avatar}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{avatarLetter}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: text }} numberOfLines={1}>
            {userEmail ?? 'user@example.com'}
          </Text>
          <Pressable onPress={onSignOut} accessibilityRole="button">
            <Text style={{ color: '#ef4444', fontWeight: '600' }}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderRightColor: '#00000012',
    flexDirection: 'column',
    minHeight: 0,
    zIndex: 30,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      default: { /* web shadow */ } as any,
    }),
  },

  drawer: {
    position: 'absolute',
    left: 0, bottom: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#00000012',
    borderTopRightRadius: 16,
    flexDirection: 'column',
    minHeight: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 12 },
      default: { /* web shadow */ } as any,
    }),
  },

  drawerHeader: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000010',
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
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  iconCell: { width: 28, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  navLabel: { fontSize: 15, fontWeight: '600' },
  sidebarFooter: {
    paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 999, backgroundColor: '#475569',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },

  sectionHeader: {
    height: 36, borderRadius: 12, paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#00000018',
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 6, backgroundColor: '#f1f5f9',
  },
  sectionTitle: {
    flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
    textTransform: 'uppercase', opacity: 0.9,
  },
  leftAccent: {
    width: 4, height: 18, borderRadius: 3, marginRight: 8,
    backgroundColor: '#cbd5e1',
  },
  itemLeftMarker: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    backgroundColor: 'transparent',
  },
});
