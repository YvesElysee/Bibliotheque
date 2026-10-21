const { Router } = require('express');
const controller = require('./exports.controller');
const { authenticate, authorize, optionalAuth } = require('../../middlewares/auth.middleware');

const router = Router();

router.get('/books/:bookId/qrcode', optionalAuth, authorize('LIBRARIAN', 'ADMIN'), controller.bookQRCode);

router.use(authenticate);

router.get('/inventory', authorize('LIBRARIAN', 'ADMIN'), controller.inventory);
router.get('/loans/me', controller.loanSheet);
router.get('/loans/:userId', authorize('LIBRARIAN', 'ADMIN'), controller.loanSheet);
router.get('/labels', authorize('LIBRARIAN', 'ADMIN'), controller.bookLabels);

module.exports = router;
