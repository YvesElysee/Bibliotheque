const reservationsService = require('./reservations.service');
const { success, created, paginated } = require('../../utils/apiResponse');

const create = async (req, res, next) => {
  try {
    const { bookId } = req.body;
    const reservation = await reservationsService.createReservation(req.user.id, bookId);
    return created(res, reservation, 'Vous avez été ajouté à la file d\'attente.');
  } catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try {
    await reservationsService.cancelReservation(req.params.id, req.user.id, req.user.role);
    return success(res, null, 'Réservation annulée.');
  } catch (err) { next(err); }
};

const getMyReservations = async (req, res, next) => {
  try {
    const { reservations, meta } = await reservationsService.getMyReservations(req.user.id, req.query);
    return paginated(res, reservations, meta);
  } catch (err) { next(err); }
};

const getBookReservations = async (req, res, next) => {
  try {
    const { reservations, meta } = await reservationsService.getBookReservations(req.params.bookId, req.query);
    return paginated(res, reservations, meta);
  } catch (err) { next(err); }
};

module.exports = { create, cancel, getMyReservations, getBookReservations };
