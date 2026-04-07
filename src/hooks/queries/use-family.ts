import { useQuery } from '@tanstack/react-query';
import { getFamily } from '../../../lib/family';
import { nullableQueryFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useFamily = (familiaId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.family.detail(familiaId!),
    queryFn: nullableQueryFnAdapter(() => getFamily(familiaId!)),
    staleTime: STALE_TIMES.family,
    enabled: !!familiaId,
  });
