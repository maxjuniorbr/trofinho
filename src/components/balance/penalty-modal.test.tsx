// Feature: ux-polish-fase4b, Property 7: Penalty dialog includes dynamic values
// Feature: ux-polish-fase4b, Property 8: Destructive action executes if and only if user confirms
import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { __APP_ALERT_MOCK__ } from '../../../test/setup';

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
    Keyboard: {
      addListener: vi.fn(() => ({ remove: vi.fn() })),
      dismiss: vi.fn(),
    },
    KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
    Modal: createHostComponent('Modal'),
    Platform: { OS: 'android', select: (obj: Record<string, unknown>) => obj.android },
    Pressable: createHostComponent('Pressable'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
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
  return renderer.root.findAll((node) => node.type === 'TextInput');
}

function findPenalizeButton(renderer: ReactTestRenderer) {
  // The "Penalizar" button is the Pressable inside the confirm area
  return renderer.root.findAll((node) => {
    if (node.type !== 'Pressable') return false;
    try {
      const texts = node.findAll((n) => n.type === 'Text');
      return texts.some((t) => t.props.children === 'Penalizar');
    } catch {
      return false;
    }
  })[0];
}

describe('PenaltyModal — confirmation dialog property tests', () => {
  const onCloseMock = vi.fn();
  const onApplyMock = vi.fn();

  type AlertButton = { text: string; style?: string; onPress?: () => void | Promise<void> };
  type AlertOptions = { message?: string; actions?: AlertButton[] };
  type SubmittedAlert = {
    alertOptions: AlertOptions;
    unmount: () => void;
  };

  /** Renders the modal, fills inputs, presses Penalizar, and asserts the app alert fired. */
  function fillAndSubmit(childName: string, amount: number): SubmittedAlert {
    const renderer = render(
      <PenaltyModal
        visible={true}
        childName={childName}
        onClose={onCloseMock}
        onApply={onApplyMock}
      />,
    );
    const inputs = findTextInputs(renderer);
    act(() => {
      inputs.find((i) => i.props.keyboardType === 'number-pad')!.props.onChangeText(String(amount));
    });
    act(() => {
      inputs.find((i) => i.props.multiline === true)!.props.onChangeText('Motivo de teste');
    });
    act(() => {
      findPenalizeButton(renderer).props.onPress();
    });
    expect(__APP_ALERT_MOCK__.showAlert).toHaveBeenCalledTimes(1);
    return {
      alertOptions: __APP_ALERT_MOCK__.showAlert.mock.calls[0][0] as AlertOptions,
      unmount: () => {
        act(() => {
          renderer.unmount();
        });
      },
    };
  }

  beforeEach(() => {
    alertMock.alert.mockReset();
    __APP_ALERT_MOCK__.showAlert.mockReset();
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
          __APP_ALERT_MOCK__.showAlert.mockReset();
          const submission = fillAndSubmit(childName, amount);
          try {
            const message = submission.alertOptions.message ?? '';
            expect(message).toContain(String(amount));
            expect(message).toContain(childName);
          } finally {
            submission.unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.4, 3.5**
  it('P8-penalty: onApply is called only when confirm button is pressed, not on cancel', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 99999 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.boolean(),
        async (amount, childName, userConfirms) => {
          __APP_ALERT_MOCK__.showAlert.mockReset();
          onApplyMock.mockReset();
          onApplyMock.mockResolvedValue({ error: null });
          const submission = fillAndSubmit(childName, amount);
          try {
            const buttons = submission.alertOptions.actions ?? [];
            if (userConfirms) {
              const confirmBtn = buttons.find((b) => b.style === 'destructive');
              await act(async () => {
                await confirmBtn?.onPress?.();
              });
              expect(onApplyMock).toHaveBeenCalledTimes(1);
            } else {
              // User cancels — do not press the destructive button
              expect(onApplyMock).not.toHaveBeenCalled();
            }
          } finally {
            submission.unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
