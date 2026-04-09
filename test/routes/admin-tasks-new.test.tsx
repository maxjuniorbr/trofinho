import React from 'react';
import {act, create, type ReactTestRenderer} from '../helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewTaskScreen from '../../app/(admin)/tasks/new';

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  dismissTo: vi.fn(),
}));

const createTaskMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const childrenMock = vi.hoisted(() => ({
  data: [
    { id: 'c1', nome: 'Ana', ativo: true },
    { id: 'c2', nome: 'Pedro', ativo: true },
    { id: 'c3', nome: 'Inativo', ativo: false },
  ],
  isLoading: false,
}));

const profileMock = vi.hoisted(() => ({
  data: { id: 'u1', familia_id: 'fam-1', nome: 'Admin' },
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

vi.mock('react-native', () => ({
  ActivityIndicator: createHostComponent('ActivityIndicator'),
  Pressable: createHostComponent('Pressable'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: createHostComponent('StatusBar'),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@lib/navigation-feedback', () => ({
  setNavigationFeedback: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useChildrenList: () => childrenMock,
  useCreateTask: () => createTaskMock,
  useProfile: () => profileMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/ui/form-footer', () => ({
  FormFooter: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement('FormFooter', props, children),
}));

vi.mock('@/components/tasks/task-form-fields', () => ({
  TaskFormFields: (props: Record<string, unknown>) =>
    React.createElement('TaskFormFields', props),
}));

vi.mock('@/components/ui/sticky-footer-screen', () => ({
  StickyFooterScreen: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) =>
    React.createElement('StickyFooterScreen', null, children, footer),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => (node.type as string) === 'Text')
    .map((node) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (Array.isArray(children)) return children.filter((c) => typeof c === 'string').join('');
      return '';
    })
    .join(' ');
}

describe('NewTaskScreen', () => {
  beforeEach(() => {
    routerMock.back.mockReset();
    routerMock.dismissTo.mockReset();
    createTaskMock.mutate.mockReset();
    createTaskMock.isPending = false;
    childrenMock.data = [
      { id: 'c1', nome: 'Ana', ativo: true },
      { id: 'c2', nome: 'Pedro', ativo: true },
      { id: 'c3', nome: 'Inativo', ativo: false },
    ];
    childrenMock.isLoading = false;
  });

  it('renders the task form fields component', () => {
    const renderer = render(<NewTaskScreen />);
    const formFields = renderer.root.findAllByType('TaskFormFields' as never);
    expect(formFields.length).toBe(1);
  });

  it('shows only active children for selection', () => {
    const renderer = render(<NewTaskScreen />);
    const text = allText(renderer);
    expect(text).toContain('Ana');
    expect(text).toContain('Pedro');
    expect(text).not.toContain('Inativo');
  });

  it('toggles child selection on press', () => {
    const renderer = render(<NewTaskScreen />);
    const childPressable = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Selecionar Ana',
    )[0];

    expect(childPressable.props.accessibilityState).toEqual({ selected: false });

    act(() => {
      childPressable.props.onPress();
    });

    const updated = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Selecionar Ana',
    )[0];
    expect(updated.props.accessibilityState).toEqual({ selected: true });
  });

  it('shows create task button', () => {
    const renderer = render(<NewTaskScreen />);
    const button = renderer.root.findAllByType('Button' as never).find(
      (b) => b.props.label === 'Criar tarefa',
    );
    expect(button).toBeDefined();
  });

  it('shows section title for child assignment', () => {
    const renderer = render(<NewTaskScreen />);
    const text = allText(renderer);
    expect(text).toContain('Atribuir para');
  });

  it('shows message when no children are registered', () => {
    childrenMock.data = [];
    const renderer = render(<NewTaskScreen />);
    const text = allText(renderer);
    expect(text).toContain('Nenhum filho cadastrado.');
  });

  it('shows loading indicator when loading children', () => {
    childrenMock.isLoading = true;
    const renderer = render(<NewTaskScreen />);
    const indicators = renderer.root.findAllByType('ActivityIndicator' as never);
    expect(indicators.length).toBeGreaterThan(0);
  });
});
