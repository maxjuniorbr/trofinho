export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  goldGlow: {
    shadowColor: '#FAC114',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
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

export const gradients = {
  gold: {
    colors: ['#FAC114', '#C57B0D'] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  goldHorizontal: {
    colors: ['#FAC114', '#C57B0D'] as const,
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
  },
  surface: {
    colors: ['#2A303C', '#1D212B'] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  // Deep navy → mid → light navy (top-to-bottom). Backdrop for the auth hero.
  heroNavy: {
    colors: ['#0F1729', '#19233F', '#283B5D'] as const,
    locations: [0, 0.6, 1] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
} as const;

// Fixed brand surfaces used by hero/marketing screens. Independent of the
// active light/dark theme — these surfaces are always dark navy.
export const heroPalette = {
  navyDeep: '#0F1729',
  navyMid: '#19233F',
  navyLight: '#283B5D',
  textOnNavy: '#FFFFFF',
  textOnNavyMuted: 'rgba(255, 255, 255, 0.70)',
  textOnNavySubtle: 'rgba(255, 255, 255, 0.55)',
  textOnNavyFaint: 'rgba(255, 255, 255, 0.35)',
  surfaceField: 'rgba(255, 255, 255, 0.06)',
  surfaceFieldFocus: 'rgba(255, 255, 255, 0.08)',
  surfaceChip: 'rgba(255, 255, 255, 0.10)',
  borderSoft: 'rgba(255, 255, 255, 0.15)',
  borderFocus: '#FAC114',
  textOnLight: '#030711',
  checkOn: '#20C55D',
  checkOnText: '#7EF1A8',
  glowGold: 'rgba(250, 193, 20, 0.12)',
  glowGoldSoft: 'rgba(250, 193, 20, 0.06)',
} as const;

export const easingPop = [0.34, 1.56, 0.64, 1] as const;
