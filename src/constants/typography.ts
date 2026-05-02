export const typography = {
  family: {
    medium: 'Nunito_500Medium',
    semibold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    extrabold: 'Nunito_800ExtraBold',
    black: 'Nunito_900Black',
  },
  // Body/UI scale: xxs..5xl. Use these for all in-app text.
  // Display scale: hero-only titles (auth landing, onboarding step titles)
  // that intentionally sit between '2xl' and '3xl'/'4xl' for brand presence.
  // Vendor exceptions (e.g. Google sign-in button at 15/20) are documented
  // inline at the call site and intentionally NOT added to the scale.
  size: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 56,
    displaySm: 26,
    display: 32,
  },
  lineHeight: {
    xxs: 14,
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
    '5xl': 64,
    displaySm: 32,
    display: 38,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
} as const;
