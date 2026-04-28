import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateInvite,
  validateInvite,
  acceptInvite,
  cancelInvite,
  removeCoAdmin,
  listFamilyAdmins,
  getPendingInvite,
} from '../../../lib/admin-invite';
import { nullableQueryFnAdapter, queryFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useAdminInvite = (familyId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.adminInvite.pending(familyId!),
    queryFn: nullableQueryFnAdapter(() => getPendingInvite(familyId!)),
    staleTime: STALE_TIMES.adminInvite,
    enabled: !!familyId,
  });

export const useFamilyAdmins = () =>
  useQuery({
    queryKey: queryKeys.adminInvite.admins(),
    queryFn: queryFnAdapter(listFamilyAdmins),
    staleTime: STALE_TIMES.adminInvite,
  });

export const useGenerateInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await generateInvite();
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInvite.all });
    },
  });
};

export const useCancelInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const result = await cancelInvite(inviteId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInvite.all });
    },
  });
};

export const useValidateInvite = (code: string) =>
  useQuery({
    queryKey: queryKeys.adminInvite.validate(code),
    queryFn: queryFnAdapter(() => validateInvite(code)),
    staleTime: STALE_TIMES.adminInvite,
    enabled: code.length === 6,
  });

export const useAcceptInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, name }: { code: string; name: string }) => {
      const result = await acceptInvite(code, name);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInvite.all });
    },
  });
};

export const useRemoveCoAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await removeCoAdmin(userId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInvite.admins() });
    },
  });
};
