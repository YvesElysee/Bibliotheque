const booksService = require('./books.service');
const { success, created, paginated } = require('../../utils/apiResponse');
const { auditLog } = require('../../utils/audit');

const getBooks = async (req, res, next) => {
  try {
    const { books, meta } = await booksService.getBooks(req.query);
    return paginated(res, books, meta);
  } catch (err) { next(err); }
};

const getBook = async (req, res, next) => {
  try {
    const book = await booksService.getBookById(req.params.id);
    return success(res, book);
  } catch (err) { next(err); }
};

const createBook = async (req, res, next) => {
  try {
    const book = await booksService.createBook(req.body, req.user.id);
    await auditLog({ userId: req.user.id, action: 'CREATE_BOOK', entityType: 'book', entityId: book.id, ipAddress: req.ip });
    return created(res, book, 'Livre ajouté avec succès.');
  } catch (err) { next(err); }
};

const updateBook = async (req, res, next) => {
  try {
    const book = await booksService.updateBook(req.params.id, req.body, req.user.id);
    await auditLog({ userId: req.user.id, action: 'UPDATE_BOOK', entityType: 'book', entityId: req.params.id, ipAddress: req.ip });
    return success(res, book, 'Livre modifié avec succès.');
  } catch (err) { next(err); }
};

const deleteBook = async (req, res, next) => {
  try {
    await booksService.deleteBook(req.params.id);
    await auditLog({ userId: req.user.id, action: 'DELETE_BOOK', entityType: 'book', entityId: req.params.id, ipAddress: req.ip });
    return success(res, null, 'Livre supprimé.');
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const stats = await booksService.getBookStats();
    return success(res, stats);
  } catch (err) { next(err); }
};

module.exports = { getBooks, getBook, createBook, updateBook, deleteBook, getStats };
