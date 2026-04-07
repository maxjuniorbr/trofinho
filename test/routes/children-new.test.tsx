// Feature: ux-polish-fase4a, Property 2: Clipboard round-trip da senha
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import NewChildScreen from '../../app/(admin)/children/new';

// --- Hoisted mocks ---

const clipboardMock = vi.hoisted(() => ({
  setStringAsync: vi.fn().mockResolvedValue(true),
}));

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
}));

const registerChildMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

const mutationStateMock = vi.hoisted(() => ({
  isPending: false,
  error: null as Error | null,
  reset: vi.fn(),
}));

vi.mock('expo-clipboard', () => clipboardMock);

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@/hooks/queries/use-register-child', () => ({
  useRegisterChild: () => ({
    ...mutationStateMock,
    mutate: (
      args: { name: string; email: string; tempPassword: string },
      opts?: { onSuccess?: () => void },
    ) => {
      registerChildMock(args.name, args.email, args.tempPassword).then(
        (res: { error: string | null }) => {
          if (!res.error && opts?.onSuccess) opts.onSuccess();
        },
      );
    },
    mutateAsync: async (args: { name: string; email: string; tempPassword: string }) => {
      return registerChildMock(args.name, args.email, args.tempPassword);
    },
  }),
}));

vi.mock('@lib/validation', () => ({
  isValidEmail: (email: string) => email.includes('@'),
  MAX_EMAIL_LENGTH: 254,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) =>
    React.createElement(
      'Pressable',
      {
        onPress: props.onPress,
        accessibilityLabel: props.accessibilityLabel,
        accessibilityRole: 'button',
      },
      React.createElement('Text', null, String(props.loading ? props.loadingLabel : props.label)),
    ),
}));

vi.mock('@/components/ui/form-footer', () => ({
  FormFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('FormFooter', null, children),
}));

vi.mock('@/components/ui/sticky-footer-screen', () => ({
  StickyFooterScreen: (
    props: Record<string, unknown> & { children?: React.ReactNode; footer?: React.ReactNode },
  ) => React.createElement('StickyFooterScreen', null, props.children, props.footer),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function changeInput(renderer: ReactTestRenderer, index: number, value: string) {
  const inputs = renderer.root.findAllByType(TextInput);
  act(() => {
    inputs[index]?.props.onChangeText(value);
  });
}

function findByA11yLabel(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0];
}

describe('NewChildScreen — Clipboard round-trip property', () => {
  beforeEach(() => {
    clipboardMock.setStringAsync.mockReset().mockResolvedValue(true);
    registerChildMock.mockReset().mockResolvedValue({ error: null });
    routerMock.back.mockReset();
  });

  // **Validates: Requirements 4.2**
  it('P2: for any password string (6–40 chars), Clipboard.setStringAsync is called with exactly that password', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 6, maxLength: 40 }), async (password) => {
        clipboardMock.setStringAsync.mockReset().mockResolvedValue(true);
        registerChildMock.mockReset().mockResolvedValue({ error: null });

        const renderer = render(<NewChildScreen />);

        // Fill form fields: name, email, password, confirm password
        changeInput(renderer, 0, 'Test Child');
        changeInput(renderer, 1, 'test@example.com');
        changeInput(renderer, 2, password);
        changeInput(renderer, 3, password);

        // Submit the form
        const submitButton = findByA11yLabel(renderer, 'Cadastrar filho');
        expect(submitButton).toBeDefined();
        await act(async () => {
          await submitButton.props.onPress();
        });

        // Now on success screen — press "Copiar senha"
        const copyButton = findByA11yLabel(renderer, 'Copiar senha para área de transferência');
        expect(copyButton).toBeDefined();

        await act(async () => {
          await copyButton.props.onPress();
        });

        expect(clipboardMock.setStringAsync).toHaveBeenCalledTimes(1);
        expect(clipboardMock.setStringAsync).toHaveBeenCalledWith(password);
      }),
      { numRuns: 100 },
    );
  });
});

describe('NewChildScreen — Copy-password UX unit tests', () => {
  beforeEach(() => {
    vi.useRealTimers();
    clipboardMock.setStringAsync.mockReset().mockResolvedValue(true);
    registerChildMock.mockReset().mockResolvedValue({ error: null });
    routerMock.back.mockReset();
  });

  const fillAndSubmit = async (renderer: ReactTestRenderer) => {
    changeInput(renderer, 0, 'Test Child');
    changeInput(renderer, 1, 'test@example.com');
    changeInput(renderer, 2, 'secret123');
    changeInput(renderer, 3, 'secret123');

    const submitButton = findByA11yLabel(renderer, 'Cadastrar filho');
    await act(async () => {
      await submitButton.props.onPress();
    });
  };

  // **Validates: Requirements 4.1**
  it('shows "Copiar senha" button on the success screen', async () => {
    const renderer = render(<NewChildScreen />);
    await fillAndSubmit(renderer);

    const copyButton = findByA11yLabel(renderer, 'Copiar senha para área de transferência');
    expect(copyButton).toBeDefined();

    const buttonText = copyButton.findAll(
      (node) => typeof node.children?.[0] === 'string' && node.children[0] === 'Copiar senha',
    );
    expect(buttonText.length).toBeGreaterThan(0);
  });

  // **Validates: Requirements 4.3**
  it('changes button text to "Copiada!" after press and reverts after 2 seconds', async () => {
    vi.useFakeTimers();

    const renderer = render(<NewChildScreen />);
    await fillAndSubmit(renderer);

    const copyButton = findByA11yLabel(renderer, 'Copiar senha para área de transferência');

    // Press the copy button
    await act(async () => {
      await copyButton.props.onPress();
    });

    // Text should now be "Copiada!"
    const copiedText = copyButton.findAll(
      (node) => typeof node.children?.[0] === 'string' && node.children[0] === 'Copiada!',
    );
    expect(copiedText.length).toBeGreaterThan(0);

    // Advance timers by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Text should revert to "Copiar senha"
    const revertedText = copyButton.findAll(
      (node) => typeof node.children?.[0] === 'string' && node.children[0] === 'Copiar senha',
    );
    expect(revertedText.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  // **Validates: Requirements 4.4**
  it('has accessibilityLabel="Copiar senha para área de transferência" on the copy button', async () => {
    const renderer = render(<NewChildScreen />);
    await fillAndSubmit(renderer);

    const copyButton = findByA11yLabel(renderer, 'Copiar senha para área de transferência');
    expect(copyButton).toBeDefined();
    expect(copyButton.props.accessibilityLabel).toBe('Copiar senha para área de transferência');
  });
});
