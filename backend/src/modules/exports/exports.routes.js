const { Router } = require('express');
const controller = require('./exports.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authenticate);

router.get('/inventory', authorize('LIBRARIAN', 'ADMIN'), controller.inventory);
router.get('/loans/me', controller.loanSheet);
router.get('/loans/:userId', authorize('LIBRARIAN', 'ADMIN'), controller.loanSheet);
router.get('/books/:bookId/qrcode', authorize('LIBRARIAN', 'ADMIN'), controller.bookQRCode);

module.exports = router;
