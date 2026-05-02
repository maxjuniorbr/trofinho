import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JoinChildScreen from '../../app/(auth)/join-child';
import LoginScreen from '../../app/(auth)/login';
import OnboardingScreen from '../../app/(auth)/onboarding';
import { supabase } from '@lib/supabase';

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
  value: {} as Record<string, string | undefined>,
}));

const childInviteMocks = vi.hoisted(() => ({
  validateChildInvite: vi.fn(),
}));

const dateOfBirthFieldState = vi.hoisted(() => ({
  onChange: null as ((date: Date) => void) | null,
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => localSearchParamsState.value,
  useRouter: () => routerMock,
  useFocusEffect: vi.fn(),
}));

vi.mock('@lib/auth', () => ({
  ...authMocks,
  signInWithGoogle: authMocks.signInWithGoogle.mockResolvedValue({ profile: null, isNewUser: false, googleName: null, error: null }),
  updateDateOfBirth: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@lib/child-invite', () => ({
  CHILD_INVITE_CODE_LENGTH: 6,
  formatChildInviteCode: (value: string) =>
    value.toUpperCase().replaceAll(/[^A-Z0-9]/g, '').slice(0, 6),
  validateChildInvite: childInviteMocks.validateChildInvite,
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
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('GoogleSignInButton', props),
}));

vi.mock('@/components/ui/bottom-sheet', () => ({
  BottomSheetModal: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('BottomSheetModal', props, props.children),
}));

vi.mock('@/components/auth/date-of-birth-field', () => ({
  DateOfBirthField: ({ error, onChange }: { error?: string | null; onChange: (d: Date) => void }) => {
    dateOfBirthFieldState.onChange = onChange;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- test mock, onChange is stable
    React.useEffect(() => { onChange(new Date(Date.UTC(2000, 0, 1))); }, []);
    return React.createElement(Text, null, error ?? 'DateOfBirthField');
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
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  initialWindowMetrics: { frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } },
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
    dateOfBirthFieldState.onChange = null;
    vi.mocked(supabase.auth.updateUser).mockClear();
    vi.mocked(supabase.functions.invoke).mockReset().mockResolvedValue({ data: { success: true }, error: null });
    childInviteMocks.validateChildInvite.mockReset().mockResolvedValue({
      preview: {
        id: 'invite-1',
        familia_id: 'family-1',
        filho_id: 'child-1',
        nome_filho: 'Ana',
        familyName: 'Família Silva',
        adminName: 'João',
      },
      error: null,
    });

    alertSpy.mockReset();

    localSearchParamsState.value = {};
  });

  it('renders the login screen with Google Sign-In', () => {
    const renderer = render(<LoginScreen />);
    expect(renderer.root).toBeTruthy();
  });

  it('renders the onboarding form with all fields', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    const renderer = render(<OnboardingScreen />);

    expect(screenText(renderer)).toContain('Criar conta');
    expect(screenText(renderer)).toContain('DateOfBirthField');

    // Advance to step 2 (family setup)
    await pressButton(renderer, 'Continuar');

    // Admin name should be pre-filled with Google name
    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs[1]?.props.value).toBe('Max');
  });

  it('validates required family name before submitting', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    const renderer = render(<OnboardingScreen />);

    await pressButton(renderer, 'Continuar');
    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe o nome da família.');
  });

  it('validates required admin name before submitting', async () => {
    localSearchParamsState.value = { googleName: '' } as never;
    const renderer = render(<OnboardingScreen />);

    await pressButton(renderer, 'Continuar');
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

    const renderer = render(<OnboardingScreen />);

    await pressButton(renderer, 'Continuar');
    changeInput(renderer, 0, 'Familia Silva');

    await pressButton(renderer, 'Criar família');

    expect(screenText(renderer)).toContain('Algo deu errado. Tente novamente.');
    expect(getButton(renderer, 'Criar família').props.accessibilityState).toEqual({ busy: false });
  });

  it('shows confirmation sheet and signs out when user confirms leave', async () => {
    localSearchParamsState.value = { googleName: 'Max' } as never;
    authMocks.signOut.mockResolvedValue(undefined);
    const renderer = render(<OnboardingScreen />);

    // Back button on step 1 triggers the confirm sheet
    await pressButton(renderer, 'Voltar');

    // Press confirm in the ConfirmSheet ('Cancelar e sair' button)
    await pressButton(renderer, 'Cancelar e sair');

    expect(authMocks.signOut).toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('validates child invite route previews before enabling Google sign-in', async () => {
    localSearchParamsState.value = {
      code: 'abc123',
      previewId: 'route-preview',
      previewFamiliaId: 'fake-family',
      previewNomeFilho: 'Ana',
      previewFamilyName: 'Família da URL',
      previewAdminName: 'Admin da URL',
    };
    childInviteMocks.validateChildInvite.mockResolvedValueOnce({
      preview: null,
      error: 'Código inválido ou expirado. Peça um novo ao responsável.',
    });

    const renderer = render(<JoinChildScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(childInviteMocks.validateChildInvite).toHaveBeenCalledWith('ABC123');
    expect(screenText(renderer)).toContain('Código inválido ou expirado');
    expect(renderer.root.findByType('GoogleSignInButton').props.disabled).toBe(true);
  });

  it('does not treat malformed child-link responses as success', async () => {
    localSearchParamsState.value = { code: 'ABC123' };
    authMocks.signInWithGoogle.mockResolvedValueOnce({
      profile: null,
      isNewUser: true,
      googleName: 'Ana',
      error: null,
    });
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: null, error: null });

    const renderer = render(<JoinChildScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await renderer.root.findByType('GoogleSignInButton').props.onPress();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => {
      dateOfBirthFieldState.onChange?.(new Date(Date.UTC(2000, 0, 1)));
    });

    expect(getButton(renderer, 'Entrar na família').props.disabled).toBe(false);
    await pressButton(renderer, 'Entrar na família');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(supabase.functions.invoke).toHaveBeenCalled();
    expect(authMocks.refreshAuthSession).not.toHaveBeenCalled();
    expect(screenText(renderer)).toContain('Erro ao vincular conta. Tente novamente.');
  });
});
