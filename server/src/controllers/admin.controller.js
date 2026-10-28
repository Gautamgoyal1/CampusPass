import eventService from '../services/eventService.js';
import userRepo from '../repositories/userRepo.js';
import { notFound } from '../utils/AppError.js';

export const getAdminEvents = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const events = await eventService.getAdminEvents(status);
    res.status(200).json({
      status: 'success',
      data: { events }
    });
  } catch (err) {
    next(err);
  }
};

export const updateEventStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const event = await eventService.updateEventStatus(req.params.id, status, req.user);
    res.status(200).json({
      status: 'success',
      data: { event }
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const updatedUser = await userRepo.updateRole(req.params.id, role);
    if (!updatedUser) {
      throw notFound('User not found', 'NOT_FOUND');
    }
    res.status(200).json({
      status: 'success',
      data: { user: updatedUser }
    });
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const users = await userRepo.findAllUsers();
    res.status(200).json({
      status: 'success',
      data: { users }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getAdminEvents,
  updateEventStatus,
  updateUserRole,
  listUsers
};
