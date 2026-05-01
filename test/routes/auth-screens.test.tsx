import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginScreen from '../../app/(auth)/login';
import OnboardingScreen from '../../app/(auth)/onboarding';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn().mockReturnValue(true),
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

vi.mock('@/components/auth/date-of-birth-field', () => ({
  DateOfBirthField: ({ onChange }: { onChange: (d: Date) => void }) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- test mock, onChange is stable
    React.useEffect(() => { onChange(new Date(Date.UTC(2000, 0, 1))); }, []);
    return React.createElement(Text, null, 'DateOfBirthField');
  },
}));

vi.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => React.createElement('DateTimePicker', props),
}));

vi.mock('@/context/impersonation-context', () => ({
  useImpersonation: () => ({ impersonating: null, startImpersonation: vi.fn(), stopImpersonation: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

  it('renders the onboarding form with all fields', () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    const renderer = render(<OnboardingScreen />);

    expect(screenText(renderer)).toContain('Criar conta');
    expect(screenText(renderer)).toContain('DateOfBirthField');

    // Admin name should be pre-filled with Google name
    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs[1]?.props.value).toBe('Max');
  });

  it('validates required family name before submitting', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    const renderer = render(<OnboardingScreen />);

    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe o nome da família.');
  });

  it('validates required admin name before submitting', async () => {
    localSearchParamsState.value = { googleName: '' } as never;
    const renderer = render(<OnboardingScreen />);

    changeInput(renderer, 0, 'Familia Silva');
    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe seu nome.');
  });

  it('creates the family, surfaces errors, and delegates navigation to auth state handler', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    authMocks.createFamily
      .mockResolvedValueOnce({ error: 'Algo deu errado. Tente novamente.' })
      .mockResolvedValueOnce({ error: null });

    const renderer = render(<OnboardingScreen />);

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

    const renderer = render(<OnboardingScreen />);

    changeInput(renderer, 0, 'Familia Silva');

    await pressButton(renderer, 'Criar família');

    expect(screenText(renderer)).toContain('Algo deu errado. Tente novamente.');
    expect(getButton(renderer, 'Criar família').props.accessibilityState).toEqual({ busy: false });
  });

  it('shows confirmation alert and signs out when user presses back', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    authMocks.signOut.mockResolvedValue(undefined);
    const renderer = render(<OnboardingScreen />);

    await pressButton(renderer, 'Voltar para login');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Voltar para o início?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Ficar', style: 'cancel' }),
        expect.objectContaining({ text: 'Voltar', style: 'destructive' }),
      ]),
    );

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const voltarButton = buttons.find((b) => b.text === 'Voltar');
    await act(async () => {
      await voltarButton!.onPress!();
    });

    expect(authMocks.signOut).toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
