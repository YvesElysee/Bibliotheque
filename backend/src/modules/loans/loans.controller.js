const loansService = require('./loans.service');
const { success, created, paginated } = require('../../utils/apiResponse');
const { auditLog } = require('../../utils/audit');
const { z } = require('zod');

const createLoan = async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
      bookId: z.string().uuid(),
      notes: z.string().max(500).optional().nullable(),
      dueDateOverride: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    });
    const parsed = schema.parse(req.body);
    const { dueDate, ...data } = parsed;
    if (!data.dueDateOverride && dueDate) data.dueDateOverride = dueDate;
    const loan = await loansService.createLoan(data, req.user.id);
    await auditLog({ userId: req.user.id, action: 'CREATE_LOAN', entityType: 'loan', entityId: loan.id, details: { bookId: data.bookId, borrowerId: data.userId }, ipAddress: req.ip });
    return created(res, loan, 'Emprunt enregistré.');
  } catch (err) { next(err); }
};

const returnLoan = async (req, res, next) => {
  try {
    const loan = await loansService.returnLoan(req.params.id, req.user.id);
    await auditLog({ userId: req.user.id, action: 'RETURN_LOAN', entityType: 'loan', entityId: req.params.id, ipAddress: req.ip });
    return success(res, loan, 'Retour enregistré avec succès.');
  } catch (err) { next(err); }
};

const renewLoan = async (req, res, next) => {
  try {
    const loan = await loansService.renewLoan(req.params.id, req.user.id);
    return success(res, loan, 'Emprunt renouvelé.');
  } catch (err) { next(err); }
};

const getMyLoans = async (req, res, next) => {
  try {
    const { loans, meta } = await loansService.getMyLoans(req.user.id, req.query);
    return paginated(res, loans, meta);
  } catch (err) { next(err); }
};

const getAllLoans = async (req, res, next) => {
  try {
    const { loans, meta } = await loansService.getAllLoans(req.query);
    return paginated(res, loans, meta);
  } catch (err) { next(err); }
};

module.exports = { createLoan, returnLoan, renewLoan, getMyLoans, getAllLoans };
