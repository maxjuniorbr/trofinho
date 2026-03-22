import type { EdgeInsets } from 'react-native-safe-area-context';

type VerticalInsets = Pick<EdgeInsets, 'top' | 'bottom'>;
type HorizontalInsets = Pick<EdgeInsets, 'left' | 'right'>;

export function getSafeTopPadding(insets: VerticalInsets, basePadding = 0) {
  return basePadding + insets.top;
}

export function getSafeBottomPadding(insets: VerticalInsets, basePadding = 0) {
  return basePadding + insets.bottom;
}

export function getSafeHorizontalPadding(insets: HorizontalInsets, basePadding = 0) {
  return {
    paddingLeft: basePadding + insets.left,
    paddingRight: basePadding + insets.right,
  };
}
