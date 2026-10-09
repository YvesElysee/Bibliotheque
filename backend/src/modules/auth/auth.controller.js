const authService = require('./auth.service');
const { success, created, error } = require('../../utils/apiResponse');

const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body, req.ip);
    const message = user.emailVerificationRequired
      ? 'Compte créé. Vérifiez votre email pour activer votre compte.'
      : 'Compte créé avec succès. Vous pouvez maintenant vous connecter.';
    return created(res, user, message);
  } catch (err) { next(err); }
};

const verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body.token);
    return success(res, result);
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, req.ip);
    return success(res, result, 'Connexion réussie.');
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    return success(res, result);
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    return success(res, null, 'Déconnexion réussie.');
  } catch (err) { next(err); }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    return success(res, null, 'Si cet email existe, un lien de réinitialisation a été envoyé.');
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body);
    return success(res, null, 'Mot de passe réinitialisé avec succès.');
  } catch (err) { next(err); }
};

module.exports = { register, verifyEmail, login, refresh, logout, forgotPassword, resetPassword };
