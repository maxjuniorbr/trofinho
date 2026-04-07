import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerChild } from '../../../lib/children';
import { mutationFnAdapter } from './query-fn-adapter';
import { queryKeys } from './query-keys';

export const useRegisterChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { name: string; email: string; tempPassword: string }) =>
      mutationFnAdapter(() => registerChild(args.name, args.email, args.tempPassword))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.children.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.all });
    },
  });
};
