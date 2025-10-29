// constants/theme.ts
import { Platform } from 'react-native';

const tintColorLight = '#2563EB';
const tintColorDark = '#60A5FA';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // === tokens nuevos (light no cambia el look) ===
    primary: '#2563EB',
    muted: '#6B7280',
    border: '#E5E7EB',
    surface: '#FFFFFF',
    surface2: '#F3F4F6',
    fieldBg: '#F8FAFC',
    fieldBorder: '#E5E7EB',
    placeholder: '#9AA0A6',
    error: '#EF4444',
    disabled: '#9CA3AF',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0B1220',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // === tokens nuevos (oscuro bien contrastado) ===
    primary: '#60A5FA',
    muted: '#9AA0A6',
    border: '#1F2937',
    surface: '#111827',
    surface2: '#0F1624',
    fieldBg: '#0F172A',
    fieldBorder: '#1F2937',
    placeholder: '#9AA0A6',
    error: '#F87171',
    disabled: '#475569',
  },
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
