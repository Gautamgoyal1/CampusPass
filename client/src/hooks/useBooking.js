import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';

export function useMyBookings() {
  return useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const res = await api.get('/me/bookings');
      return res.data.bookings;
    }
  });
}

export function useBooking(eventId) {
  const queryClient = useQueryClient();

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/events/${eventId}/bookings`);
      return res.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', String(eventId)] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId) => {
      const res = await api.delete(`/bookings/${bookingId}`);
      return res.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    }
  });

  return {
    bookSeat: bookMutation.mutateAsync,
    isBooking: bookMutation.isPending,
    bookingError: bookMutation.error,
    cancelBooking: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    cancelError: cancelMutation.error
  };
}

export default useBooking;
