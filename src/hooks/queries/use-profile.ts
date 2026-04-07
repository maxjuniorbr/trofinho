import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  getCurrentAuthUser,
  updateUserName,
  updateUserPassword,
  updateUserAvatar,
  deleteAccount,
} from '../../../lib/auth';
import { getNotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '../../../lib/notifications';
import { mutationFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useProfile = () =>
  useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async () => {
      const profile = await getProfile();
      if (!profile) throw new Error('Perfil não encontrado.');
      return profile;
    },
    staleTime: STALE_TIMES.profile,
  });

export const useCurrentAuthUser = () =>
  useQuery({
    queryKey: queryKeys.profile.authUser(),
    queryFn: async () => {
      const user = await getCurrentAuthUser();
      if (!user) throw new Error('Usuário não autenticado.');
      return user;
    },
    staleTime: STALE_TIMES.profile,
  });

export const useNotificationPrefs = () =>
  useQuery({
    queryKey: queryKeys.profile.notificationPrefs(),
    queryFn: async () => {
      try {
        return await getNotificationPrefs();
      } catch {
        return DEFAULT_NOTIFICATION_PREFS;
      }
    },
    staleTime: STALE_TIMES.profile,
  });

export const useUpdateUserName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => mutationFnAdapter(() => updateUserName(name))(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
};

export const useUpdateUserPassword = () =>
  useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => mutationFnAdapter(() => updateUserPassword(currentPassword, newPassword))(),
  });

export const useUpdateUserAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageUri: string) => {
      const result = await updateUserAvatar(imageUri);
      if (result.error) throw new Error(result.error);
      return result.url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
};

export const useDeleteAccount = () =>
  useMutation({
    mutationFn: () => mutationFnAdapter(() => deleteAccount())(),
  });
