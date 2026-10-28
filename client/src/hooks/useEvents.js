import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

export function useEvents({ search = '', category = '' } = {}) {
  return useInfiniteQuery({
    queryKey: ['events', { search, category }],
    queryFn: async ({ pageParam = null }) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (pageParam) params.set('cursor', pageParam);
      params.set('limit', '6');

      const res = await api.get(`/events?${params.toString()}`);
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
    initialPageParam: null,
    staleTime: 30 * 1000 // 30 seconds client cache
  });
}

export function useEventDetail(eventId) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}`);
      return res.data.event;
    },
    enabled: Boolean(eventId),
    staleTime: 10 * 1000
  });
}

export default useEvents;
