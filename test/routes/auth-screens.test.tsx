import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginScreen from '../../app/(auth)/login';
import OnboardingScreen from '../../app/(auth)/onboarding';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  createFamily: vi.fn(),
  getCurrentAuthUser: vi.fn(),
  refreshAuthSession: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}));

const localSearchParamsState = vi.hoisted(() => ({
  value: {} as { name?: string; email?: string },
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => localSearchParamsState.value,
  useRouter: () => routerMock,
  useFocusEffect: vi.fn((callback: () => void | (() => void)) => callback()),
}));

vi.mock('@lib/auth', () => ({
  ...authMocks,
  signInWithGoogle: authMocks.signInWithGoogle.mockResolvedValue({ profile: null, isNewUser: false, googleName: null, error: null }),
  updateDateOfBirth: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { identities: [{ provider: 'google' }] } },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
    },
  },
}));

vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('GoogleSignInButton', props),
}));

vi.mock('@/components/auth/date-of-birth-step', async () => {
  const react = await import('react');
  return {
    DateOfBirthStep: ({ onChange, onContinue }: { onChange: (d: Date) => void; onContinue: () => void }) => {
      react.useEffect(() => { onChange(new Date(Date.UTC(2000, 0, 1))); }, []);
      return React.createElement(
        Pressable,
        { accessibilityLabel: 'Continuar', onPress: onContinue },
        React.createElement(Text, null, 'Continuar'),
      );
    },
  };
});

vi.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => React.createElement('DateTimePicker', props),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

async function renderAsync(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  await act(async () => {
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

function focusInput(renderer: ReactTestRenderer, index: number) {
  const inputs = renderer.root.findAllByType(TextInput);

  act(() => {
    inputs[index]?.props.onFocus?.();
  });
}

function blurInput(renderer: ReactTestRenderer, index: number) {
  const inputs = renderer.root.findAllByType(TextInput);

  act(() => {
    inputs[index]?.props.onBlur?.();
  });
}

function pressButton(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root
    .findAllByType(Pressable)
    .find((node) => node.props.accessibilityLabel === label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return act(async () => {
    await button.props.onPress();
  });
}

function screenText(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .map((node) => String(node.props.children))
    .join(' ');
}

function getButton(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root
    .findAllByType(Pressable)
    .find((node) => node.props.accessibilityLabel === label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

describe('auth screens', () => {
  const alertSpy = vi.mocked(Alert.alert);

  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.push.mockReset();
    routerMock.replace.mockReset();

    authMocks.createFamily.mockReset();
    authMocks.getCurrentAuthUser.mockReset().mockResolvedValue(null);
    authMocks.refreshAuthSession.mockReset().mockResolvedValue({ error: null });
    authMocks.signInWithGoogle.mockReset().mockResolvedValue({ profile: null, isNewUser: false, googleName: null, error: null });
    authMocks.signOut.mockReset();

    alertSpy.mockReset();

    localSearchParamsState.value = {};
  });

  it('renders the login screen with Google Sign-In', () => {
    const renderer = render(<LoginScreen />);
    expect(renderer.root).toBeTruthy();
  });

  it('prefills onboarding with the Google name and shows DOB step first', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    const renderer = await renderAsync(<OnboardingScreen />);

    // Step 1 is the DOB step — family form is not visible yet
    expect(screenText(renderer)).toContain('Nascimento');
  });

  it('advances to family step after DOB and validates required data', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    const renderer = await renderAsync(<OnboardingScreen />);

    // Advance past DOB step
    await pressButton(renderer, 'Continuar');

    // Now on step 2 — admin name should be pre-filled with Google name
    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs[1]?.props.value).toBe('Max');

    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe o nome da família.');
  });

  it('covers onboarding focus, name validation, and button style branches', async () => {
    localSearchParamsState.value = { googleName: '' } as never;
    const renderer = await renderAsync(<OnboardingScreen />);

    // Advance past DOB step
    await pressButton(renderer, 'Continuar');

    focusInput(renderer, 0);
    blurInput(renderer, 0);
    focusInput(renderer, 1);
    blurInput(renderer, 1);

    changeInput(renderer, 0, 'Familia Silva');
    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe seu nome.');
  });

  it('creates the family, surfaces errors, and delegates navigation to auth state handler', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    authMocks.createFamily
      .mockResolvedValueOnce({ error: 'Algo deu errado. Tente novamente.' })
      .mockResolvedValueOnce({ error: null });

    const renderer = await renderAsync(<OnboardingScreen />);

    // Advance past DOB step
    await pressButton(renderer, 'Continuar');

    changeInput(renderer, 0, 'Familia Silva');

    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Algo deu errado. Tente novamente.');

    await pressButton(renderer, 'Criar família');
    expect(authMocks.refreshAuthSession).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('shows an inline error when session refresh after family creation fails', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    authMocks.createFamily.mockResolvedValueOnce({ error: null });
    authMocks.refreshAuthSession.mockResolvedValueOnce({
      error: 'Algo deu errado. Tente novamente.',
    });

    const renderer = await renderAsync(<OnboardingScreen />);

    // Advance past DOB step
    await pressButton(renderer, 'Continuar');

    changeInput(renderer, 0, 'Familia Silva');

    await pressButton(renderer, 'Criar família');

    expect(screenText(renderer)).toContain('Algo deu errado. Tente novamente.');
    expect(getButton(renderer, 'Criar família').props.accessibilityState).toEqual({ busy: false });
  });

  it('shows confirmation alert and signs out when register user confirms exit', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    authMocks.signOut.mockResolvedValue(undefined);
    const renderer = await renderAsync(<OnboardingScreen />);

    // Advance past DOB step
    await pressButton(renderer, 'Continuar');

    // The footer link triggers the alert.
    await pressButton(renderer, 'Criar família depois');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Sair da criação da família?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Continuar criando', style: 'cancel' }),
        expect.objectContaining({ text: 'Sair', style: 'destructive' }),
      ]),
    );

    // Confirm exit via the alert's destructive button.
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const sairButton = buttons.find((b) => b.text === 'Sair');
    await act(async () => {
      await sairButton!.onPress!();
    });

    expect(authMocks.signOut).toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('signs out when orphan user confirms exit via footer link (no params.name)', async () => {
    localSearchParamsState.value = {};
    authMocks.signOut.mockResolvedValue(undefined);
    authMocks.getCurrentAuthUser.mockResolvedValue({
      email: 'orphan@example.com',
      avatarUrl: null,
    });

    const renderer = await renderAsync(<OnboardingScreen />);

    // Advance past DOB step
    await pressButton(renderer, 'Continuar');

    await pressButton(renderer, 'Criar família depois');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Sair da criação da família?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Continuar criando', style: 'cancel' }),
        expect.objectContaining({ text: 'Sair', style: 'destructive' }),
      ]),
    );

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const sairButton = buttons.find((b) => b.text === 'Sair');
    await act(async () => {
      await sairButton!.onPress!();
    });

    expect(authMocks.signOut).toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
