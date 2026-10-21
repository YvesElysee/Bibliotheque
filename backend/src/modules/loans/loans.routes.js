const { Router } = require('express');
const controller = require('./loans.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

router.get('/my', controller.getMyLoans);
router.get('/reminders', authorize('LIBRARIAN', 'ADMIN'), controller.getReminders);
router.put('/:id/renew', controller.renewLoan);
router.get('/', authorize('LIBRARIAN', 'ADMIN'), controller.getAllLoans);
router.post('/', authorize('LIBRARIAN', 'ADMIN'), controller.createLoan);
router.put('/:id/return', authorize('LIBRARIAN', 'ADMIN'), controller.returnLoan);

module.exports = router;
