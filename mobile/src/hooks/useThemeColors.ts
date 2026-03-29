import { useAppSettings } from '../context/AppSettingsContext';
import { Colors } from '../constants/theme';

export function useThemeColors() {
  const { theme } = useAppSettings();
  const isDark = theme === 'dark';
  return {
    isDark,
    bg: isDark ? Colors.backgroundDark : '#ffffff',                  // #0f1710 / #ffffff
    card: isDark ? Colors.cardBgDark : Colors.cardBg,               // #1a241b / #ffffff
    border: isDark ? Colors.borderDark : Colors.border,             // #2d3748 / #e5e7eb
    text: isDark ? Colors.foregroundDark : Colors.foreground,       // #e7efe4 / #1e2a1a
    textMuted: isDark ? '#9ca3af' : '#6b7280',
    textSubtle: isDark ? '#6b7280' : '#9ca3af',
    inputBg: isDark ? '#1a241b' : '#ffffff',
    surface: isDark ? '#1e2d1f' : '#f9fafb',
    pillBg: isDark ? '#1a241b' : '#ffffff',
    overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.6)',
  };
}
