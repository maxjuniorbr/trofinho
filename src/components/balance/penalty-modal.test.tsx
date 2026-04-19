// Feature: ux-polish-fase4b, Property 7: Penalty dialog includes dynamic values
// Feature: ux-polish-fase4b, Property 8: Destructive action executes if and only if user confirms
import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
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
    Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
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

  type AlertButton = { text: string; style: string; onPress?: () => void | Promise<void> };
  type AlertCall = [title: string, message: string, buttons: AlertButton[]];
  type SubmittedAlert = {
    alertCall: AlertCall;
    unmount: () => void;
  };

  /** Renders the modal, fills inputs, presses Penalizar, and asserts the alert fired. */
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
    expect(alertMock.alert).toHaveBeenCalledTimes(1);
    return {
      alertCall: alertMock.alert.mock.calls[0] as AlertCall,
      unmount: () => {
        act(() => {
          renderer.unmount();
        });
      },
    };
  }

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
          const submission = fillAndSubmit(childName, amount);
          try {
            const [, message] = submission.alertCall;
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
          alertMock.alert.mockReset();
          onApplyMock.mockReset();
          onApplyMock.mockResolvedValue({ error: null });
          const submission = fillAndSubmit(childName, amount);
          try {
            const [, , buttons] = submission.alertCall;
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
