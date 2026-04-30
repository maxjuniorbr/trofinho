/**
 * Tokens for interactive feedback (pressed states, transitions).
 *
 * Three opacity tiers cover all pressable surfaces in the app and
 * give kids a predictable, snappy feedback signal:
 *
 * - `surface`  large pressable surfaces (cards, list rows, sheet items).
 * - `control`  buttons, icon buttons, segmented controls, inputs.
 * - `link`     inline text links and ghost actions.
 *
 * Composite "premium" presses that combine opacity with a scale
 * transform (hero cards) keep their own inline style and are not
 * covered by these tokens.
 */
export const opacityPressed = {
  surface: 0.9,
  control: 0.7,
  link: 0.6,
} as const;

export type PressedOpacityToken = keyof typeof opacityPressed;

/**
 * Tokens for disabled / inactive states.
 *
 * Consistent dimming tells kids (and parents) at a glance what is
 * interactive and what is not:
 *
 * - `heavy`   primary CTAs, action buttons — must be obviously untouchable.
 * - `medium`  inputs, secondary controls, archived cards.
 * - `light`   inactive list items, paused tasks — still legible but faded.
 */
export const opacityDisabled = {
  heavy: 0.45,
  medium: 0.55,
  light: 0.6,
} as const;

export type DisabledOpacityToken = keyof typeof opacityDisabled;
