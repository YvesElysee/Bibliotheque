const { Router } = require('express');
const controller = require('./requests.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authenticate);

router.get('/my', controller.getMy);
router.post('/', controller.create);
router.get('/', authorize('LIBRARIAN', 'ADMIN'), controller.getAll);
router.put('/:id', authorize('LIBRARIAN', 'ADMIN'), controller.updateOne);

module.exports = router;
