import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';

import * as childrenLib from '../../../../lib/children';
import * as rq from '@tanstack/react-query';

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => {
  const capturedMutation: { options: Record<string, unknown>[] } = { options: [] };

  return {
    useMutation: vi.fn((opts: Record<string, unknown>) => {
      capturedMutation.options.push(opts);
      return { mutate: vi.fn(), isPending: false };
    }),
    useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }: { children: unknown }) => children,
    _capturedMutation: capturedMutation,
  };
});

vi.mock('../../../../lib/children', () => ({
  registerChild: vi.fn().mockResolvedValue({ data: { id: 'new-child' }, error: null }),
}));

type CapturedStore = { options: Record<string, unknown>[] };
const getCapturedMutation = () =>
  (rq as unknown as { _capturedMutation: CapturedStore })._capturedMutation;
const lastMutationOpts = () => getCapturedMutation().options.at(-1)!;

beforeEach(() => {
  getCapturedMutation().options = [];
  mockInvalidateQueries.mockClear();
});

const loadHook = () => import('../use-register-child');

describe('useRegisterChild', () => {
  it('calls registerChild via mutationFn', async () => {
    const { useRegisterChild } = await loadHook();
    useRegisterChild();
    const opts = lastMutationOpts();
    const mutationFn = opts.mutationFn as (args: {
      name: string;
      email: string;
      tempPassword: string;
    }) => Promise<unknown>;
    await mutationFn({ name: 'Ana', email: 'ana@test.com', tempPassword: '123456' });
    expect(childrenLib.registerChild).toHaveBeenCalledWith(
      'Ana',
      'ana@test.com',
      '123456',
      undefined,
    );
  });

  it('invalidates children and balances queries on success', async () => {
    const { useRegisterChild } = await loadHook();
    useRegisterChild();
    const opts = lastMutationOpts();
    const onSuccess = opts.onSuccess as () => void;
    onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.children.all });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
  });
});
