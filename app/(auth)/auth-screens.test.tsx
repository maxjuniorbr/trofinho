import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text, TextInput } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  createFamily: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

const localSearchParamsState = vi.hoisted(() => ({
  value: {} as { name?: string },
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => localSearchParamsState.value,
  useRouter: () => routerMock,
}));

vi.mock('@lib/auth', () => authMocks);

import LoginScreen from './login';
import OnboardingScreen from './onboarding';
import RegisterScreen from './register';

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
  const button = renderer.root.findAllByType(Pressable)
    .find((node) => node.props.accessibilityLabel === label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return act(async () => {
    await button.props.onPress();
  });
}

function screenText(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType(Text)
    .map((node) => String(node.props.children))
    .join(' ');
}

function getButton(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root.findAllByType(Pressable)
    .find((node) => node.props.accessibilityLabel === label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

describe('auth screens', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.push.mockReset();
    routerMock.replace.mockReset();

    authMocks.createFamily.mockReset();
    authMocks.signIn.mockReset();
    authMocks.signOut.mockReset();
    authMocks.signUp.mockReset();

    localSearchParamsState.value = {};
  });

  it('validates login form input before calling sign in', async () => {
    const renderer = render(<LoginScreen />);

    await pressButton(renderer, 'Entrar');

    expect(authMocks.signIn).not.toHaveBeenCalled();
    expect(screenText(renderer)).toContain('Informe seu e-mail.');
  });

  it('routes login users according to the returned profile', async () => {
    authMocks.signIn
      .mockResolvedValueOnce({ profile: null, error: null })
      .mockResolvedValueOnce({ profile: { papel: 'admin' }, error: null })
      .mockResolvedValueOnce({ profile: { papel: 'filho' }, error: null })
      .mockResolvedValueOnce({ profile: null, error: { message: 'Invalid login credentials' } });

    const renderer = render(<LoginScreen />);
    changeInput(renderer, 0, 'max@example.com');
    changeInput(renderer, 1, '123456');

    await pressButton(renderer, 'Entrar');
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/onboarding');

    await pressButton(renderer, 'Entrar');
    expect(routerMock.replace).toHaveBeenCalledWith('/(admin)/');

    await pressButton(renderer, 'Entrar');
    expect(routerMock.replace).toHaveBeenCalledWith('/(child)/');

    await pressButton(renderer, 'Entrar');
    expect(screenText(renderer)).toContain('E-mail ou senha incorretos.');
  });

  it('navigates from login to the register screen', async () => {
    const renderer = render(<LoginScreen />);

    await pressButton(renderer, 'Criar conta');

    expect(routerMock.push).toHaveBeenCalledWith('/(auth)/register');
  });

  it('covers the remaining login validation and field focus branches', async () => {
    const renderer = render(<LoginScreen />);

    focusInput(renderer, 0);
    blurInput(renderer, 0);
    focusInput(renderer, 1);
    blurInput(renderer, 1);

    changeInput(renderer, 0, 'invalido');
    await pressButton(renderer, 'Entrar');
    expect(screenText(renderer)).toContain('E-mail inválido.');

    changeInput(renderer, 0, 'max@example.com');
    await pressButton(renderer, 'Entrar');
    expect(screenText(renderer)).toContain('Informe sua senha.');

    changeInput(renderer, 1, '123');
    await pressButton(renderer, 'Entrar');
    expect(screenText(renderer)).toContain('A senha deve ter ao menos 6 caracteres.');

    const registerButton = getButton(renderer, 'Criar conta');
    expect(registerButton.props.style({ pressed: true })[1].opacity).toBe(0.65);
  });

  it('validates register input and handles provider errors', async () => {
    authMocks.signUp.mockResolvedValueOnce({
      error: { message: 'User already registered' },
    });

    const renderer = render(<RegisterScreen />);
    await pressButton(renderer, 'Criar conta');
    expect(screenText(renderer)).toContain('Informe seu nome.');

    changeInput(renderer, 0, 'Max');
    changeInput(renderer, 1, 'max@example.com');
    changeInput(renderer, 2, '123456');
    changeInput(renderer, 3, '123456');

    await pressButton(renderer, 'Criar conta');

    expect(authMocks.signUp).toHaveBeenCalledWith('max@example.com', '123456');
    expect(screenText(renderer)).toContain('Este e-mail já está cadastrado.');
  });

  it('navigates to onboarding after registration and supports going back', async () => {
    authMocks.signUp.mockResolvedValue({ error: null });

    const renderer = render(<RegisterScreen />);
    changeInput(renderer, 0, 'Max');
    changeInput(renderer, 1, 'max@example.com');
    changeInput(renderer, 2, '123456');
    changeInput(renderer, 3, '123456');

    await pressButton(renderer, 'Criar conta');
    expect(routerMock.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/onboarding',
      params: { name: 'Max' },
    });

    await pressButton(renderer, 'Voltar ao login');
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('covers the remaining register validation and focus branches', async () => {
    const renderer = render(<RegisterScreen />);

    focusInput(renderer, 0);
    blurInput(renderer, 0);
    focusInput(renderer, 1);
    blurInput(renderer, 1);
    focusInput(renderer, 2);
    blurInput(renderer, 2);
    focusInput(renderer, 3);
    blurInput(renderer, 3);

    changeInput(renderer, 0, 'Max');
    changeInput(renderer, 1, 'email-invalido');
    await pressButton(renderer, 'Criar conta');
    expect(screenText(renderer)).toContain('E-mail inválido.');

    changeInput(renderer, 1, 'max@example.com');
    await pressButton(renderer, 'Criar conta');
    expect(screenText(renderer)).toContain('Crie uma senha.');

    changeInput(renderer, 2, '123');
    await pressButton(renderer, 'Criar conta');
    expect(screenText(renderer)).toContain('A senha deve ter ao menos 6 caracteres.');

    changeInput(renderer, 2, '123456');
    changeInput(renderer, 3, '654321');
    await pressButton(renderer, 'Criar conta');
    expect(screenText(renderer)).toContain('As senhas não coincidem.');

    const backButton = getButton(renderer, 'Voltar ao login');
    expect(backButton.props.style({ pressed: true })[1].opacity).toBe(0.65);
  });

  it('prefills onboarding with the routed name and validates required data', async () => {
    localSearchParamsState.value = { name: 'Max' };
    const renderer = render(<OnboardingScreen />);

    expect(renderer.root.findAllByType(TextInput)[1]?.props.value).toBe('Max');

    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe o nome da família.');
  });

  it('covers onboarding focus, name validation, and button style branches', async () => {
    localSearchParamsState.value = { name: '' };
    const renderer = render(<OnboardingScreen />);

    focusInput(renderer, 0);
    blurInput(renderer, 0);
    focusInput(renderer, 1);
    blurInput(renderer, 1);

    changeInput(renderer, 0, 'Familia Silva');
    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Informe seu nome.');

    const backButton = getButton(renderer, 'Voltar ao login');
    expect(backButton.props.style({ pressed: true })[1].opacity).toBe(0.65);
  });

  it('creates the family, surfaces errors, and logs out back to login', async () => {
    localSearchParamsState.value = { name: 'Max' };
    authMocks.createFamily
      .mockResolvedValueOnce({ error: { message: 'Usuário não autenticado' } })
      .mockResolvedValueOnce({ error: null });
    authMocks.signOut.mockResolvedValue(undefined);

    const renderer = render(<OnboardingScreen />);
    changeInput(renderer, 0, 'Familia Silva');

    await pressButton(renderer, 'Criar família');
    expect(screenText(renderer)).toContain('Algo deu errado. Tente novamente.');

    await pressButton(renderer, 'Criar família');
    expect(routerMock.replace).toHaveBeenCalledWith('/(admin)/');

    await pressButton(renderer, 'Voltar ao login');
    expect(authMocks.signOut).toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
