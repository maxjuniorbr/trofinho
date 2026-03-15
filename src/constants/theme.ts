/** Trofinho design tokens aligned with the pixel-polish-partner reference theme. */

export const lightColors = {
  bg: {
    canvas:  '#F9FAFB',
    surface: '#FFFFFF',
    elevated:'#EDF0F3',
    muted:   '#EAEDF0',
  },
  brand: {
    vivid:    '#FAC114',
    dim:      '#C57B0D',
    subtle:   'rgba(250, 193, 20, 0.10)',
    gradient: ['#FAC114', '#C57B0D'] as const,
  },
  accent: {
    admin:    '#1B284B',
    adminDim: '#1B284B',
    adminBg:  '#EDF0F3',
    filho:    '#0DCCF2',
    filhoDim: '#5AD8F2',
    filhoBg:  'rgba(13, 204, 242, 0.10)',
  },
  text: {
    primary:   '#030711',
    secondary: '#65758B',
    muted:     '#65758B',
    inverse:   '#FFFFFF',
    onBrand:   '#030711',
  },
  semantic: {
    success:   '#20C55D',
    successBg: '#E4FBED',
    error:     '#DC2828',
    errorBg:   '#FDE7E7',
    warning:   '#F59F0A',
    warningBg: '#FFF6E5',
    info:      '#308CE8',
    infoBg:    '#E5F2FF',
    successText: '#1A6636',
    errorText:   '#7A1F1F',
    warningText: '#8A5D0F',
    infoText:    '#0F4D8A',
  },
  border: {
    subtle:  '#E0E5EB',
    default: '#E0E5EB',
    focus:   '#FAC114',
    error:   '#DC2828',
  },
  shadow: {
    low:    '0 1px 2px rgba(3, 7, 17, 0.04)',
    medium: '0 4px 12px rgba(3, 7, 17, 0.08)',
    high:   '0 8px 24px rgba(3, 7, 17, 0.12)',
    brand:  '0 4px 16px rgba(250, 193, 20, 0.30)',
  },
  statusBar: 'dark' as const,
} as const;

export const darkColors = {
  bg: {
    canvas:  '#131720',
    surface: '#1D212B',
    elevated:'#2A303C',
    muted:   '#262B36',
  },
  brand: {
    vivid:    '#FAC114',
    dim:      '#C57B0D',
    subtle:   'rgba(250, 193, 20, 0.10)',
    gradient: ['#FAC114', '#C57B0D'] as const,
  },
  accent: {
    admin:    '#DBE6F0',
    adminDim: '#2A303C',
    adminBg:  '#2A303C',
    filho:    '#0DCCF2',
    filhoDim: '#6CD9EF',
    filhoBg:  'rgba(13, 204, 242, 0.18)',
  },
  text: {
    primary:   '#F1F5F9',
    secondary: '#7B899D',
    muted:     '#7B899D',
    inverse:   '#FFFFFF',
    onBrand:   '#030711',
  },
  semantic: {
    success:   '#20C55D',
    successBg: '#173622',
    error:     '#DC2828',
    errorBg:   '#391313',
    warning:   '#F59F0A',
    warningBg: '#3D2C0F',
    info:      '#308CE8',
    infoBg:    '#132639',
    successText: '#7EF1A8',
    errorText:   '#F17E7E',
    warningText: '#FFD080',
    infoText:    '#8FC7FF',
  },
  border: {
    subtle:  '#303541',
    default: '#303541',
    focus:   '#FAC114',
    error:   '#DC2828',
  },
  shadow: {
    low:    '0 1px 2px rgba(0, 0, 0, 0.20)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.30)',
    high:   '0 8px 24px rgba(0, 0, 0, 0.40)',
    brand:  '0 4px 16px rgba(250, 193, 20, 0.20)',
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
    shadowColor: '#FAC114',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  /** 3-D bottom shadow — use under primary gradient buttons */
  goldButton: {
    shadowColor: '#C57B0D',
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
    colors: ['#FAC114', '#C57B0D'] as const,
    start:  { x: 0.5, y: 0 },
    end:    { x: 0.5, y: 1 },
  },
  goldHorizontal: {
    colors: ['#FAC114', '#C57B0D'] as const,
    start:  { x: 0, y: 0.5 },
    end:    { x: 1, y: 0.5 },
  },
  surface: {
    colors: ['#2A303C', '#1D212B'] as const,
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
    xs:    12,
    sm:    14,
    md:    16,
    lg:    18,
    xl:    20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    xs:    16,
    sm:    20,
    md:    24,
    lg:    28,
    xl:    28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
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
  '1':   4,
  '2':   8,
  '3':  12,
  '4':  16,
  '5':  20,
  '6':  24,
  '8':  32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  // Semantic aliases mapped to base scale values
  screen:  24, // spacing['6']
  card:    16, // spacing['4']
  section: 32, // spacing['8']
  item:    12, // spacing['3']
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
