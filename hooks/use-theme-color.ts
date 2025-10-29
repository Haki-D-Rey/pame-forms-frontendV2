// hooks/use-theme-color.ts
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

type ColorKey = keyof typeof Colors['light']; // incluye tokens nuevos

export function useThemeColor(
  props: { light?: string; dark?: string } = {},
  colorName: ColorKey
) {
  const theme = useColorScheme() ?? 'light';
  const override = props[theme];
  return override ?? (Colors as any)[theme]?.[colorName] ?? Colors.light[colorName];
}
