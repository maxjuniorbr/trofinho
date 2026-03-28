import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  getCurrentAuthUser,
  updateUserName,
  updateUserPassword,
  updateUserAvatar,
} from '../../../lib/auth';
import { getNotificationPrefs } from '../../../lib/notifications';
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
    queryFn: () => getNotificationPrefs(),
    staleTime: STALE_TIMES.profile,
  });

export const useUpdateUserName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const result = await updateUserName(name);
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
};

export const useUpdateUserPassword = () =>
  useMutation({
    mutationFn: async (newPassword: string) => {
      const result = await updateUserPassword(newPassword);
      if (result.error) throw new Error(result.error.message);
    },
  });

export const useUpdateUserAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (imageUri: string) => {
      const result = await updateUserAvatar(imageUri);
      if (result.error) throw new Error(result.error.message);
      return result.url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });
};
