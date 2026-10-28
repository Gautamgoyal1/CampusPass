import bookingService from '../services/bookingService.js';

export const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.bookSeat(req.params.id, req.user);
    res.status(201).json({
      status: 'success',
      data: { booking }
    });
  } catch (err) {
    next(err);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await bookingService.getUserBookings(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { bookings }
    });
  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(req.params.id, req.user);
    res.status(200).json({
      status: 'success',
      data: { booking },
      message: 'Booking cancelled successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const getEventAttendees = async (req, res, next) => {
  try {
    const attendees = await bookingService.getEventAttendees(req.params.id, req.user);
    res.status(200).json({
      status: 'success',
      data: { attendees }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  createBooking,
  getMyBookings,
  cancelBooking,
  getEventAttendees
};
