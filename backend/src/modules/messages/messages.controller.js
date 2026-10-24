const messagesService = require('./messages.service');
const { success, paginated } = require('../../utils/apiResponse');

const create = async (req, res, next) => {
  try {
    const msg = await messagesService.create(req.body);
    return success(res, msg, 'Votre message a été envoyé. Nous vous répondrons dans les plus brefs délais.', 201);
  } catch (err) { next(err); }
};

const getAll = async (req, res, next) => {
  try {
    const { data, meta } = await messagesService.getAll(req.query);
    return paginated(res, data, meta);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const msg = await messagesService.getOne(req.params.id, req.user.id);
    return success(res, msg);
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    const msg = await messagesService.markRead(req.params.id, req.user.id);
    return success(res, msg, 'Message marqué comme lu.');
  } catch (err) { next(err); }
};

const markUnread = async (req, res, next) => {
  try {
    const msg = await messagesService.markUnread(req.params.id);
    return success(res, msg, 'Message marqué comme non lu.');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await messagesService.remove(req.params.id);
    return success(res, null, 'Message supprimé.');
  } catch (err) { next(err); }
};

const countUnread = async (req, res, next) => {
  try {
    const count = await messagesService.countUnread();
    return success(res, { count });
  } catch (err) { next(err); }
};

module.exports = { create, getAll, getOne, markRead, markUnread, remove, countUnread };
