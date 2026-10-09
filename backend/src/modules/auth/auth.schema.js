const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères').max(100),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  preferredLanguage: z.enum(['FR', 'EN']).default('FR'),
});

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Minimum 8 caractères').max(100),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
};
