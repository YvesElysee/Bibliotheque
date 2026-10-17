const exportsService = require('./exports.service');

const inventory = async (req, res, next) => {
  try { await exportsService.generateInventoryPDF(res); }
  catch (err) { next(err); }
};

const loanSheet = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    await exportsService.generateLoanSheetPDF(res, userId);
  } catch (err) { next(err); }
};

const bookQRCode = async (req, res, next) => {
  try { await exportsService.generateBookQRCode(res, req.params.bookId); }
  catch (err) { next(err); }
};

const bookLabels = async (req, res, next) => {
  try {
    // ?ids=a,b,c (optionnel) pour n'étiqueter que certains ouvrages
    const ids = typeof req.query.ids === 'string' && req.query.ids.trim()
      ? req.query.ids.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    await exportsService.generateBookLabelsPDF(res, ids);
  } catch (err) { next(err); }
};

module.exports = { inventory, loanSheet, bookQRCode, bookLabels };
