import { useQuery } from '@tanstack/react-query';
import { getFamily } from '../../../lib/family';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useFamily = (familiaId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.family.detail(familiaId!),
    queryFn: async () => {
      const family = await getFamily(familiaId!);
      if (!family) throw new Error('Família não encontrada.');
      return family;
    },
    staleTime: STALE_TIMES.family,
    enabled: !!familiaId,
  });
