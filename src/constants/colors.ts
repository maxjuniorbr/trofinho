const brandColors = {
  vivid: '#FAC114',
  dim: '#C57B0D',
  subtle: 'rgba(250, 193, 20, 0.10)',
  gradient: ['#FAC114', '#C57B0D'] as const,
} as const;

const sharedTextColors = {
  inverse: '#FFFFFF',
  inverseMuted: 'rgba(255, 255, 255, 0.85)',
  inverseSubtle: 'rgba(255, 255, 255, 0.8)',
  onBrand: '#030711',
  onBrandMuted: 'rgba(42, 36, 16, 0.75)',
} as const;

const sharedOverlayColors = {
  scrim: 'rgba(0, 0, 0, 0.45)',
  scrimSoft: 'rgba(0, 0, 0, 0.4)',
} as const;

const sharedBorderColors = {
  focus: '#FAC114',
  error: '#DC2828',
} as const;

type ThemeConfig = Readonly<{
  bg: {
    canvas: string;
    surface: string;
    elevated: string;
    muted: string;
  };
  accent: {
    admin: string;
    adminDim: string;
    adminBg: string;
    filho: string;
    filhoDim: string;
    filhoBg: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  semantic: {
    success: string;
    successBg: string;
    error: string;
    errorBg: string;
    warning: string;
    warningBg: string;
    info: string;
    infoBg: string;
    successText: string;
    errorText: string;
    warningText: string;
    infoText: string;
  };
  border: {
    subtle: string;
    default: string;
  };
  shadow: {
    low: string;
    medium: string;
    high: string;
    brand: string;
  };
  statusBar: 'dark' | 'light';
}>;

function createThemeColors(config: ThemeConfig) {
  return {
    bg: config.bg,
    brand: brandColors,
    accent: config.accent,
    text: {
      ...config.text,
      ...sharedTextColors,
    },
    semantic: config.semantic,
    border: {
      ...config.border,
      ...sharedBorderColors,
    },
    overlay: sharedOverlayColors,
    shadow: config.shadow,
    statusBar: config.statusBar,
  } as const;
}

export const lightColors = createThemeColors({
  bg: {
    canvas: '#F9FAFB',
    surface: '#FFFFFF',
    elevated: '#EDF0F3',
    muted: '#EAEDF0',
  },
  accent: {
    admin: '#FAC114',
    adminDim: '#C57B0D',
    adminBg: 'rgba(250, 193, 20, 0.10)',
    filho: '#FAC114',
    filhoDim: '#C57B0D',
    filhoBg: 'rgba(250, 193, 20, 0.10)',
  },
  text: {
    primary: '#030711',
    secondary: '#65758B',
    muted: '#65758B',
  },
  semantic: {
    success: '#20C55D',
    successBg: '#E4FBED',
    error: '#DC2828',
    errorBg: '#FDE7E7',
    warning: '#F59F0A',
    warningBg: '#FFF6E5',
    info: '#308CE8',
    infoBg: '#E5F2FF',
    successText: '#1A6636',
    errorText: '#7A1F1F',
    warningText: '#8A5D0F',
    infoText: '#0F4D8A',
  },
  border: {
    subtle: '#E0E5EB',
    default: '#E0E5EB',
  },
  shadow: {
    low: '0 1px 2px rgba(3, 7, 17, 0.04)',
    medium: '0 4px 12px rgba(3, 7, 17, 0.08)',
    high: '0 8px 24px rgba(3, 7, 17, 0.12)',
    brand: '0 4px 16px rgba(250, 193, 20, 0.30)',
  },
  statusBar: 'dark',
});

export const darkColors = createThemeColors({
  bg: {
    canvas: '#131720',
    surface: '#1D212B',
    elevated: '#2A303C',
    muted: '#262B36',
  },
  accent: {
    admin: '#FAC114',
    adminDim: '#C57B0D',
    adminBg: 'rgba(250, 193, 20, 0.18)',
    filho: '#FAC114',
    filhoDim: '#C57B0D',
    filhoBg: 'rgba(250, 193, 20, 0.18)',
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#7B899D',
    muted: '#7B899D',
  },
  semantic: {
    success: '#20C55D',
    successBg: '#173622',
    error: '#DC2828',
    errorBg: '#391313',
    warning: '#F59F0A',
    warningBg: '#3D2C0F',
    info: '#308CE8',
    infoBg: '#132639',
    successText: '#7EF1A8',
    errorText: '#F17E7E',
    warningText: '#FFD080',
    infoText: '#8FC7FF',
  },
  border: {
    subtle: '#303541',
    default: '#303541',
  },
  shadow: {
    low: '0 1px 2px rgba(0, 0, 0, 0.20)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.30)',
    high: '0 8px 24px rgba(0, 0, 0, 0.40)',
    brand: '0 4px 16px rgba(250, 193, 20, 0.20)',
  },
  statusBar: 'light',
});

export type ThemeColors = typeof lightColors;

/**
 * Appends a hex alpha suffix to a 6-digit hex color.
 * Example: withAlpha('#DC2828', 0.25) → '#DC282840'
 */
export function withAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}
