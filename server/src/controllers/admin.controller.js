import eventService from '../services/eventService.js';
import userRepo from '../repositories/userRepo.js';
import { notFound, forbidden } from '../utils/AppError.js';

export const getAdminEvents = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const category = req.query.category || '';
    const search = req.query.search || '';
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const events = await eventService.getAdminEvents({ status, category, search, limit, offset });
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

    // Self-demotion protection: prevent administrators from stripping their own admin role
    if (String(req.user.id) === String(req.params.id) && role !== 'admin') {
      throw forbidden('Administrators cannot remove their own administrative role', 'SELF_DEMOTION_PROHIBITED');
    }

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
    const search = req.query.search || '';
    const role = req.query.role || '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { users, total } = await userRepo.findAllUsers({ search, role, limit, offset });
    res.status(200).json({
      status: 'success',
      data: {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getPlatformStats = async (req, res, next) => {
  try {
    const stats = await eventService.getPlatformStats();
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  getAdminEvents,
  updateEventStatus,
  updateUserRole,
  listUsers,
  getPlatformStats
};
