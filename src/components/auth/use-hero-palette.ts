import { useTheme } from '@/context/theme-context';
import { gradients, heroPalette, heroPaletteLight } from '@/constants/theme';

type HeroPalette = Record<keyof typeof heroPalette, string>;
type HeroGradient = {
  colors: readonly [string, string, string];
  locations: readonly [number, number, number];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/**
 * Returns the hero (auth) palette and gradient that match the active device
 * theme. The auth flow follows the system color scheme by default — dark
 * devices get the navy hero, light devices get the warm cream hero. Component
 * keys (e.g. `textOnNavy`, `surfaceField`) are kept stable across both
 * variants so the same call sites work in either mode.
 */
export function useHeroPalette(): {
  palette: HeroPalette;
  gradient: HeroGradient;
  isDark: boolean;
} {
  const { isDark } = useTheme();
  return {
    palette: isDark ? heroPalette : heroPaletteLight,
    gradient: isDark ? gradients.heroNavy : gradients.heroLight,
    isDark,
  };
}
