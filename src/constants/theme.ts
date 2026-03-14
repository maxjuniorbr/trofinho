/** Trofinho – Design System Tokens
 *
 * Golden trophy identity: #F5C518 brand, warm-dark canvas, expressive palette.
 * Derived from trofinho-design-studio (Lovable/Tailwind) → translated to RN.
 * Admin role: violet accent  |  Filho role: sky-blue accent
 * Light + dark palettes; system default with optional user override.
 */

export const lightColors = {
  bg: {
    canvas:  '#F0F2F5',   // hsl(220 10% 95%) — warm off-white
    surface: '#FFFFFF',
    elevated:'#F5F6F8',   // cards on canvas
    muted:   '#E8EAF0',   // subtle pill backgrounds
  },
  brand: {
    vivid:    '#F5C518',
    dim:      '#C8860A',
    subtle:   'rgba(245, 197, 24, 0.15)',
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
    primary:   '#111827',   // hsl(220 20% 8%) — same as dark canvas
    secondary: '#4B5563',
    muted:     '#9CA3AF',
    inverse:   '#FFFFFF',
    onBrand:   '#2a2410',   // hsl(46 20% 10%) — from design-studio
  },
  semantic: {
    success:   '#16a34a',
    successBg: '#dcfce7',
    error:     '#DC2626',
    errorBg:   '#FEF2F2',
    warning:   '#D97706',
    warningBg: '#FFFBEB',
    info:      '#2563EB',
    infoBg:    '#EFF6FF',
  },
  border: {
    subtle:  '#E5E7EB',
    default: '#D1D5DB',
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
    // Aligned with design-studio: hsl(220 20% 8/12/18/25%)
    canvas:  '#111827',   // hsl(220 20% 8%)  — studio --background
    surface: '#1a2233',   // hsl(220 20% 12%) — studio --surface
    elevated:'#253042',   // hsl(220 20% 18%) — studio --surface-bright
    muted:   '#2d3548',   // hsl(220 10% 25%) — studio --muted
  },
  brand: {
    vivid:    '#F5C518',   // hsl(46 92% 53%)  — studio --primary
    dim:      '#C8860A',   // hsl(39 90% 41%)  — studio --primary-dark
    subtle:   'rgba(245, 197, 24, 0.15)',
    gradient: ['#F5C518', '#C8860A'] as const,
  },
  accent: {
    admin:    '#A78BFA',
    adminDim: '#7C3AED',
    adminBg:  '#1a1428',
    filho:    '#38BDF8',
    filhoDim: '#0EA5E9',
    filhoBg:  '#0d1e2e',
  },
  text: {
    primary:   '#ede8e0',   // hsl(40 10% 92%) — studio --foreground
    secondary: '#a8acb8',   // hsl(220 10% 70%)
    muted:     '#8a8f99',   // hsl(220 10% 60%) — studio --muted-foreground
    inverse:   '#111827',
    onBrand:   '#2a2410',   // hsl(46 20% 10%) — studio --primary-foreground
  },
  semantic: {
    success:   '#22c55e',   // hsl(142 70% 45%) — studio --success
    successBg: 'rgba(34, 197, 94, 0.15)',
    error:     '#ef4444',   // hsl(0 84% 60%)   — studio --destructive
    errorBg:   'rgba(239, 68, 68, 0.15)',
    warning:   '#e6a817',   // hsl(39 90% 50%)  — studio --warning
    warningBg: 'rgba(230, 168, 23, 0.18)',
    info:      '#60A5FA',
    infoBg:    'rgba(96, 165, 250, 0.15)',
  },
  border: {
    subtle:  '#1f2b3d',   // hsl(220 20% 16%) — studio --border
    default: '#253042',   // hsl(220 20% 18%)
    focus:   '#F5C518',
    error:   '#ef4444',
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

/** Shadows in React Native format (shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation) */
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  /** Gold ambient glow — use on featured/active cards */
  goldGlow: {
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  /** 3-D bottom shadow — use under primary gradient buttons */
  goldButton: {
    shadowColor: '#966508',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

/** Gradient configs for expo-linear-gradient */
export const gradients = {
  gold: {
    colors: ['#F5C518', '#C8860A'] as const,
    start:  { x: 0.5, y: 0 },
    end:    { x: 0.5, y: 1 },
  },
  goldHorizontal: {
    colors: ['#F5C518', '#C8860A'] as const,
    start:  { x: 0, y: 0.5 },
    end:    { x: 1, y: 0.5 },
  },
  surface: {
    colors: ['#1e2a3a', '#151d2b'] as const,
    start:  { x: 0.5, y: 0 },
    end:    { x: 0.5, y: 1 },
  },
} as const;

export const typography = {
  /** Nunito font family — loaded via @expo-google-fonts/nunito in app/_layout.tsx */
  family: {
    medium:    'Nunito_500Medium',
    semibold:  'Nunito_600SemiBold',
    bold:      'Nunito_700Bold',
    extrabold: 'Nunito_800ExtraBold',
    black:     'Nunito_900Black',
  },
  size: {
    xs:    11,
    sm:    13,
    md:    15,
    lg:    17,
    xl:    20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weight: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
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
  // Semantic aliases (from design-studio)
  screen: 24,  // standard horizontal screen padding
  card:   20,  // internal card padding
  section:24,  // gap between major sections
  item:   12,  // gap between list items
} as const;

export const radii = {
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  // Semantic aliases (from design-studio)
  inner: 16,   // inputs, badges, inner cards
  outer: 24,   // main cards, modals, bottom sheets
  full:  9999,
} as const;

/** Bouncy easing — cubic-bezier(0.34, 1.56, 0.64, 1) for Reanimated */
export const easingPop = [0.34, 1.56, 0.64, 1] as const;
