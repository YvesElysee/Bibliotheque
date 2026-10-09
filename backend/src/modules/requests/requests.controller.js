const requestsService = require('./requests.service');
const { success, created, paginated } = require('../../utils/apiResponse');
const { z } = require('zod');

const create = async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(255),
      author: z.string().max(255).optional().nullable(),
      publisher: z.string().max(255).optional().nullable(),
      description: z.string().max(2000).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
    });
    const parsed = schema.parse(req.body);
    const data = {
      title: parsed.title,
      author: parsed.author || undefined,
      publisher: parsed.publisher || undefined,
      description: parsed.description || parsed.notes || undefined,
    };
    const request = await requestsService.createRequest(req.user.id, data);
    return created(res, request, 'Demande enregistrée. Les bibliothécaires en seront informés.');
  } catch (err) { next(err); }
};

const getAll = async (req, res, next) => {
  try {
    const { requests, meta } = await requestsService.getAllRequests(req.query);
    return paginated(res, requests, meta);
  } catch (err) { next(err); }
};

const updateOne = async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'ACQUIRED', 'CLOSED']),
      adminNotes: z.string().max(1000).optional(),
    });
    const data = schema.parse(req.body);
    const request = await requestsService.updateRequest(req.params.id, data);
    return success(res, request, 'Demande mise à jour.');
  } catch (err) { next(err); }
};

const getMy = async (req, res, next) => {
  try {
    const { requests, meta } = await requestsService.getMyRequests(req.user.id, req.query);
    return paginated(res, requests, meta);
  } catch (err) { next(err); }
};

module.exports = { create, getAll, updateOne, getMy };
