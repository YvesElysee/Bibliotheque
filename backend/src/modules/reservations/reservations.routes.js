const { Router } = require('express');
const controller = require('./reservations.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

router.get('/my', controller.getMyReservations);
router.post('/', controller.create);
router.delete('/:id', controller.cancel);
router.get('/book/:bookId', authorize('LIBRARIAN', 'ADMIN'), controller.getBookReservations);

module.exports = router;
