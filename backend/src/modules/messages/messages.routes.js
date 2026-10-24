const { Router } = require('express');
const controller = require('./messages.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();

// Public
router.post('/', controller.create);

// Admin/Bibliothécaire
router.get('/', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.getAll);
router.get('/unread/count', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.countUnread);
router.get('/:id', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.getOne);
router.put('/:id/read', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.markRead);
router.put('/:id/unread', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.markUnread);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.remove);

module.exports = router;
