const { Router } = require('express');
const controller = require('./categories.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();

router.get('/', controller.getAll);
router.post('/', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.create);
router.put('/:id', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.update);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.remove);

module.exports = router;
