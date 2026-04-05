// Feature: ux-polish-fase4b, Property 7: Penalty dialog includes dynamic values
// Feature: ux-polish-fase4b, Property 8: Destructive action executes if and only if user confirms
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { PenaltyModal } from './penalty-modal';

// --- Hoisted mocks ---

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const createHostComponent = vi.hoisted(() => {
  return (name: string) =>
    React.forwardRef(function HostComponent(
      props: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>,
    ) {
      return React.createElement(name, { ...props, ref }, props.children);
    });
});

vi.mock('react-native', () => {
  return {
    ActivityIndicator: createHostComponent('ActivityIndicator'),
    Alert: alertMock,
    KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
    Modal: createHostComponent('Modal'),
    Pressable: createHostComponent('Pressable'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: createHostComponent('Text'),
    TextInput: createHostComponent('TextInput'),
    View: createHostComponent('View'),
  };
});

vi.mock('@/components/ui/form-footer', () => ({
  FormFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('FormFooter', null, children),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function findTextInputs(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => (node.type as string) === 'TextInput');
}

function findPenalizeButton(renderer: ReactTestRenderer) {
  // The "Penalizar" button is the Pressable inside the confirm area
  return renderer.root.findAll((node) => {
    if ((node.type as string) !== 'Pressable') return false;
    try {
      const texts = node.findAll((n) => (n.type as string) === 'Text');
      return texts.some((t) => t.props.children === 'Penalizar');
    } catch {
      return false;
    }
  })[0];
}

describe('PenaltyModal — confirmation dialog property tests', () => {
  const onCloseMock = vi.fn();
  const onApplyMock = vi.fn();

  beforeEach(() => {
    alertMock.alert.mockReset();
    onCloseMock.mockReset();
    onApplyMock.mockReset();
    onApplyMock.mockResolvedValue({ error: null });
  });

  // **Validates: Requirements 3.3**
  it('P7: penalty dialog message contains both amount and child name for any values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        (amount, childName) => {
          alertMock.alert.mockReset();

          const renderer = render(
            <PenaltyModal
              visible={true}
              childName={childName}
              onClose={onCloseMock}
              onApply={onApplyMock}
            />,
          );

          // Fill in amount and description fields
          const inputs = findTextInputs(renderer);
          const amountInput = inputs.find((i) => i.props.keyboardType === 'number-pad');
          const descInput = inputs.find((i) => i.props.multiline === true);

          act(() => {
            amountInput!.props.onChangeText(String(amount));
          });
          act(() => {
            descInput!.props.onChangeText('Motivo de teste');
          });

          // Press the "Penalizar" button
          const penalizeBtn = findPenalizeButton(renderer);
          act(() => {
            penalizeBtn.props.onPress();
          });

          expect(alertMock.alert).toHaveBeenCalledTimes(1);
          const message = alertMock.alert.mock.calls[0][1] as string;
          expect(message).toContain(String(amount));
          expect(message).toContain(childName);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.4, 3.5**
  it('P8-penalty: onApply is called only when confirm button is pressed, not on cancel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.boolean(),
        (amount, childName, userConfirms) => {
          alertMock.alert.mockReset();
          onApplyMock.mockReset();
          onApplyMock.mockResolvedValue({ error: null });

          const renderer = render(
            <PenaltyModal
              visible={true}
              childName={childName}
              onClose={onCloseMock}
              onApply={onApplyMock}
            />,
          );

          const inputs = findTextInputs(renderer);
          const amountInput = inputs.find((i) => i.props.keyboardType === 'number-pad');
          const descInput = inputs.find((i) => i.props.multiline === true);

          act(() => {
            amountInput!.props.onChangeText(String(amount));
          });
          act(() => {
            descInput!.props.onChangeText('Motivo de teste');
          });

          const penalizeBtn = findPenalizeButton(renderer);
          act(() => {
            penalizeBtn.props.onPress();
          });

          expect(alertMock.alert).toHaveBeenCalledTimes(1);
          const buttons = alertMock.alert.mock.calls[0][2] as {
            text: string;
            style: string;
            onPress?: () => void;
          }[];

          if (userConfirms) {
            const confirmBtn = buttons.find((b) => b.style === 'destructive');
            act(() => {
              confirmBtn!.onPress!();
            });
            expect(onApplyMock).toHaveBeenCalledTimes(1);
          } else {
            // User cancels — do not press the destructive button
            expect(onApplyMock).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
