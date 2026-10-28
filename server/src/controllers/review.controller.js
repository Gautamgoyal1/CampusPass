import reviewService from '../services/reviewService.js';

export const createReview = async (req, res, next) => {
  try {
    const review = await reviewService.addReview(req.params.id, req.body, req.user);
    res.status(201).json({
      status: 'success',
      data: { review }
    });
  } catch (err) {
    next(err);
  }
};

export const getReviews = async (req, res, next) => {
  try {
    const reviews = await reviewService.getEventReviews(req.params.id);
    res.status(200).json({
      status: 'success',
      data: { reviews }
    });
  } catch (err) {
    next(err);
  }
};

export default {
  createReview,
  getReviews
};
