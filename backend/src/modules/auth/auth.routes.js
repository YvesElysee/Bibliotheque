const { Router } = require('express');
const controller = require('./auth.controller');
const { validateBody } = require('../../middlewares/validate.middleware');
const { authRateLimiter, emailRateLimiter } = require('../../middlewares/rateLimit.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} = require('./auth.schema');

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), controller.register);
router.post('/verify-email', validateBody(verifyEmailSchema), controller.verifyEmail);
router.post('/login', authRateLimiter, validateBody(loginSchema), controller.login);
router.post('/refresh', validateBody(refreshSchema), controller.refresh);
router.post('/logout', controller.logout);
router.post('/forgot-password', emailRateLimiter, validateBody(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), controller.resetPassword);

module.exports = router;
