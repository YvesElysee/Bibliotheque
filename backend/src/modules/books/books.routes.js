const { Router } = require('express');
const controller = require('./books.controller');
const { authenticate, authorize, optionalAuth } = require('../../middlewares/auth.middleware');
const { validateBody, validateQuery } = require('../../middlewares/validate.middleware');
const { createBookSchema, updateBookSchema, bookQuerySchema } = require('./books.schema');

const router = Router();

// Routes publiques (catalogue accessible sans connexion)
router.get('/', optionalAuth, validateQuery(bookQuerySchema), controller.getBooks);
router.get('/stats', controller.getStats);

// Intégrations externes : recherche ISBN + résumé IA (protégées — bibliothécaires/admin)
// ⚠️ DOIVENT être déclarées AVANT "/:id" sinon "lookup" serait interprété comme un id.
router.get('/lookup', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.lookupBook);
router.post('/ai-summary', optionalAuth, controller.aiSummary);
router.post('/cover', authenticate, authorize('LIBRARIAN', 'ADMIN'), controller.uploadCover);

router.get('/:id', optionalAuth, controller.getBook);

// Routes protégées — LIBRARIAN / ADMIN uniquement
router.post('/', authenticate, authorize('LIBRARIAN', 'ADMIN'), validateBody(createBookSchema), controller.createBook);
router.put('/:id', authenticate, authorize('LIBRARIAN', 'ADMIN'), validateBody(updateBookSchema), controller.updateBook);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.deleteBook);

module.exports = router;
