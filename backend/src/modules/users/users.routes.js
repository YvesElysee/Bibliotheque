const { Router } = require('express');
const controller = require('./users.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

// Profil de l'utilisateur connecté
router.get('/me', controller.getProfile);
router.put('/me', controller.updateProfile);

// Administration
router.get('/admin/stats', authorize('LIBRARIAN', 'ADMIN'), controller.getAdminStats);
router.get('/admin/audit', authorize('ADMIN'), controller.getAuditLogs);
router.get('/', authorize('LIBRARIAN', 'ADMIN'), controller.getAll);
router.get('/:id', authorize('LIBRARIAN', 'ADMIN'), controller.getOne);
router.put('/:id/role', authorize('ADMIN'), controller.updateRole);
router.put('/:id/toggle-active', authorize('ADMIN'), controller.toggleActive);

module.exports = router;
