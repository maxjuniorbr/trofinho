import { useQuery } from '@tanstack/react-query';
import { listChildren, getChild } from '../../../lib/children';
import { queryFnAdapter } from './query-fn-adapter';
import { queryKeys, STALE_TIMES } from './query-keys';

export const useChildrenList = () =>
  useQuery({
    queryKey: queryKeys.children.lists(),
    queryFn: queryFnAdapter(() => listChildren()),
    staleTime: STALE_TIMES.children,
  });

export const useChildDetail = (childId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.children.detail(childId!),
    queryFn: queryFnAdapter(() => getChild(childId!)),
    staleTime: STALE_TIMES.children,
    enabled: !!childId,
  });
