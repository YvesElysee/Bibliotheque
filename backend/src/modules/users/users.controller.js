const usersService = require('./users.service');
const { success, paginated } = require('../../utils/apiResponse');
const { auditLog } = require('../../utils/audit');

const getAll = async (req, res, next) => {
  try {
    const { users, meta } = await usersService.getAll(req.query);
    return paginated(res, users, meta);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const user = await usersService.getById(req.params.id);
    return success(res, user);
  } catch (err) { next(err); }
};

const updateRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await usersService.updateRole(req.params.id, role);
    await auditLog({ userId: req.user.id, action: 'UPDATE_USER_ROLE', entityType: 'user', entityId: req.params.id, details: { newRole: role }, ipAddress: req.ip });
    return success(res, user, 'Rôle mis à jour.');
  } catch (err) { next(err); }
};

const toggleActive = async (req, res, next) => {
  try {
    const user = await usersService.toggleActive(req.params.id);
    await auditLog({ userId: req.user.id, action: 'TOGGLE_USER_ACTIVE', entityType: 'user', entityId: req.params.id, ipAddress: req.ip });
    return success(res, user);
  } catch (err) { next(err); }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await usersService.getProfile(req.user.id);
    return success(res, user);
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await usersService.updateProfile(req.user.id, req.body);
    return success(res, user, 'Profil mis à jour.');
  } catch (err) { next(err); }
};

const getAdminStats = async (req, res, next) => {
  try {
    const stats = await usersService.getAdminStats();
    return success(res, stats);
  } catch (err) { next(err); }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const { logs, meta } = await usersService.getAuditLogs(req.query);
    return paginated(res, logs, meta);
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, updateRole, toggleActive, getProfile, updateProfile, getAdminStats, getAuditLogs };
