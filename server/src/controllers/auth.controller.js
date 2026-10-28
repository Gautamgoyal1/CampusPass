import authService from '../services/authService.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/tokens.js';

export const register = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    setRefreshTokenCookie(res, refreshToken);
    res.status(201).json({
      status: 'success',
      data: { user, accessToken }
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    setRefreshTokenCookie(res, refreshToken);
    res.status(200).json({
      status: 'success',
      data: { user, accessToken }
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    const { user, accessToken, refreshToken } = await authService.refresh(token);
    setRefreshTokenCookie(res, refreshToken);
    res.status(200).json({
      status: 'success',
      data: { user, accessToken }
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    await authService.logout(token);
    clearRefreshTokenCookie(res);
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await authService.getUserProfile(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  register,
  login,
  refresh,
  logout,
  me
};
