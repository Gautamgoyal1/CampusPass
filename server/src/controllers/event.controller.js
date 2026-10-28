import eventService from '../services/eventService.js';

export const listEvents = async (req, res, next) => {
  try {
    const { search, category, cursor, limit } = req.query;
    const result = await eventService.getPublicEvents({ search, category, cursor, limit });
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getEvent = async (req, res, next) => {
  try {
    const event = await eventService.getEventDetails(req.params.id, req.user);
    res.status(200).json({
      status: 'success',
      data: { event }
    });
  } catch (err) {
    next(err);
  }
};

export const createEvent = async (req, res, next) => {
  try {
    const event = await eventService.createEvent(req.body, req.user);
    res.status(201).json({
      status: 'success',
      data: { event }
    });
  } catch (err) {
    next(err);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const event = await eventService.updateEvent(req.params.id, req.body, req.user);
    res.status(200).json({
      status: 'success',
      data: { event }
    });
  } catch (err) {
    next(err);
  }
};

export const getMyEvents = async (req, res, next) => {
  try {
    const events = await eventService.getOrganiserEvents(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { events }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  getMyEvents
};
