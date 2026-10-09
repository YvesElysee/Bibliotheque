const reviewsService = require('./reviews.service');
const { success, created } = require('../../utils/apiResponse');
const { z } = require('zod');

const createOrUpdate = async (req, res, next) => {
  try {
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(1000).optional(),
    });
    const data = schema.parse(req.body);
    const review = await reviewsService.createOrUpdateReview(req.user.id, req.params.bookId, data);
    return created(res, review, 'Avis enregistré.');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await reviewsService.deleteReview(req.params.id, req.user.id, req.user.role);
    return success(res, null, 'Avis supprimé.');
  } catch (err) { next(err); }
};

module.exports = { createOrUpdate, remove };
