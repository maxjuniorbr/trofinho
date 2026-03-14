/** Trofinho – Design System Tokens
 *
 * Golden trophy identity: #F5C518 brand, warm-dark canvas, expressive palette.
 * Admin role: violet accent  |  Filho role: sky-blue accent
 * Light + dark palettes; system default with optional user override.
 */

export const lightColors = {
  bg: {
    canvas:  '#F8F7FF',   // warm lavender white
    surface: '#FFFFFF',
    elevated:'#F2F0FF',   // slight tint for cards
    muted:   '#EDE9FF',   // subtle pill backgrounds
  },
  brand: {
    vivid:    '#F5C518',
    dim:      '#C8860A',
    subtle:   'rgba(245, 197, 24, 0.14)',
    gradient: ['#F5C518', '#C8860A'] as const,
  },
  accent: {
    admin:    '#6D28D9',
    adminDim: '#4C1D95',
    adminBg:  '#F5F3FF',
    filho:    '#0284C7',
    filhoDim: '#075985',
    filhoBg:  '#F0F9FF',
  },
  text: {
    primary:   '#111827',
    secondary: '#4B5563',
    muted:     '#9CA3AF',
    inverse:   '#FFFFFF',
    onBrand:   '#1A0F00',
  },
  semantic: {
    success:   '#059669',
    successBg: '#ECFDF5',
    error:     '#DC2626',
    errorBg:   '#FEF2F2',
    warning:   '#D97706',
    warningBg: '#FFFBEB',
    info:      '#2563EB',
    infoBg:    '#EFF6FF',
  },
  border: {
    subtle:  '#EDE9FF',
    default: '#D1C4E9',
    focus:   '#F5C518',
    error:   '#DC2626',
  },
  shadow: {
    low:    '0 1px 4px rgba(0, 0, 0, 0.07)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.10)',
    high:   '0 8px 24px rgba(0, 0, 0, 0.14)',
    brand:  '0 4px 16px rgba(245, 197, 24, 0.28)',
  },
  statusBar: 'dark' as const,
} as const;

export const darkColors = {
  bg: {
    canvas:  '#0D0D12',
    surface: '#16161F',
    elevated:'#1E1E2A',
    muted:   '#26263A',
  },
  brand: {
    vivid:    '#F5C518',
    dim:      '#C8860A',
    subtle:   'rgba(245, 197, 24, 0.12)',
    gradient: ['#F5C518', '#C8860A'] as const,
  },
  accent: {
    admin:    '#A78BFA',
    adminDim: '#7C3AED',
    adminBg:  '#1A1428',
    filho:    '#38BDF8',
    filhoDim: '#0EA5E9',
    filhoBg:  '#0D1E2E',
  },
  text: {
    primary:   '#F1F0FF',
    secondary: '#A8A8C0',
    muted:     '#64648A',
    inverse:   '#0D0D12',
    onBrand:   '#1A0F00',
  },
  semantic: {
    success:   '#34D399',
    successBg: '#042F1E',
    error:     '#F87171',
    errorBg:   '#2D0A0A',
    warning:   '#FCD34D',
    warningBg: '#2E1B00',
    info:      '#60A5FA',
    infoBg:    '#0C1D3A',
  },
  border: {
    subtle:  '#26263A',
    default: '#36365A',
    focus:   '#F5C518',
    error:   '#F87171',
  },
  shadow: {
    low:    '0 1px 4px rgba(0, 0, 0, 0.40)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.50)',
    high:   '0 8px 24px rgba(0, 0, 0, 0.60)',
    brand:  '0 4px 16px rgba(245, 197, 24, 0.20)',
  },
  statusBar: 'light' as const,
} as const;

export type ThemeColors = typeof lightColors;

export const typography = {
  size: {
    xs:  11,
    sm:  13,
    md:  15,
    lg:  17,
    xl:  20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weight: {
    regular: '400' as const,
    medium:  '500' as const,
    semibold:'600' as const,
    bold:    '700' as const,
    extrabold:'800' as const,
  },
} as const;

export const spacing = {
  '1':  4,
  '2':  8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10':40,
  '12':48,
} as const;

export const radii = {
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  full:9999,
} as const;
