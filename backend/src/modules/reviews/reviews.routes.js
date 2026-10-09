const { Router } = require('express');
const controller = require('./reviews.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authenticate);
router.post('/book/:bookId', controller.createOrUpdate);
router.delete('/:id', controller.remove);

module.exports = router;
