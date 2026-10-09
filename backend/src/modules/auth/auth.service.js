const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database');
const { sendEmail } = require('../../config/email');
const { logger } = require('../../utils/logger');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7');
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = () => uuidv4();

// ─── Service Auth ──────────────────────────────────────────────────────────────

const register = async ({ email, password, firstName, lastName, preferredLanguage }, ipAddress) => {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    const err = new Error('Un compte avec cet email existe déjà.');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const verifyToken = uuidv4();

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      preferredLanguage,
      isEmailVerified: !REQUIRE_EMAIL_VERIFICATION,
      emailVerifyToken: REQUIRE_EMAIL_VERIFICATION ? verifyToken : null,
      firstLoginIp: ipAddress,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  // Envoi email de vérification (uniquement si la vérification est activée)
  if (REQUIRE_EMAIL_VERIFICATION) {
    const verifyUrl = `${process.env.FRONTEND_URL || ''}/pages/verify-email.html?token=${verifyToken}`;
    await sendEmail({
      to: email,
      subject: 'Vérifiez votre adresse email — Bibliothèque',
      html: `
        <h2>Bienvenue ${firstName} !</h2>
        <p>Cliquez sur le lien ci-dessous pour vérifier votre adresse email :</p>
        <a href="${verifyUrl}" style="background:#4F46E5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">
          Vérifier mon email
        </a>
        <p style="margin-top:16px;color:#6B7280;font-size:12px;">Lien valable 24 heures.</p>
      `,
    }).catch((e) => logger.warn('Email vérification non envoyé:', e.message));
  }

  return { ...user, emailVerificationRequired: REQUIRE_EMAIL_VERIFICATION };
};

const verifyEmail = async (token) => {
  const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
  if (!user) {
    const err = new Error('Token de vérification invalide ou expiré.');
    err.statusCode = 400;
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });

  return { message: 'Email vérifié avec succès.' };
};

const login = async ({ email, password }, ipAddress) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    const err = new Error('Email ou mot de passe incorrect.');
    err.statusCode = 401;
    throw err;
  }

  if (REQUIRE_EMAIL_VERIFICATION && !user.isEmailVerified) {
    const err = new Error('Veuillez vérifier votre adresse email avant de vous connecter.');
    err.statusCode = 403;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const err = new Error('Email ou mot de passe incorrect.');
    err.statusCode = 401;
    throw err;
  }

  // Génération des tokens
  const accessToken = generateAccessToken(user);
  const refreshTokenValue = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { token: refreshTokenValue, userId: user.id, expiresAt },
  });

  // Mise à jour de la dernière connexion
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
    },
  };
};

const refreshToken = async (token) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    const err = new Error('Refresh token invalide ou expiré.');
    err.statusCode = 401;
    throw err;
  }

  const accessToken = generateAccessToken(stored.user);
  return { accessToken };
};

const logout = async (token) => {
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
  }
};

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Ne pas révéler si l'email existe
  if (!user) return;

  const resetToken = uuidv4();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken: resetToken, resetPasswordExpires: expires },
  });

  const resetUrl = `${process.env.FRONTEND_URL}/pages/reset-password.html?token=${resetToken}`;
  await sendEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe — Bibliothèque',
    html: `
      <h2>Réinitialisation du mot de passe</h2>
      <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
      <a href="${resetUrl}" style="background:#4F46E5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">
        Réinitialiser le mot de passe
      </a>
      <p style="margin-top:16px;color:#6B7280;font-size:12px;">Lien valable 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    `,
  }).catch((e) => logger.warn('Email reset password non envoyé:', e.message));
};

const resetPassword = async ({ token, password }) => {
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: { gt: new Date() },
    },
  });

  if (!user) {
    const err = new Error('Token de réinitialisation invalide ou expiré.');
    err.statusCode = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null },
  });

  // Invalider tous les refresh tokens
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  await sendEmail({
    to: user.email,
    subject: 'Mot de passe modifié — Bibliothèque',
    html: '<p>Votre mot de passe a été modifié avec succès.</p>',
  }).catch(() => {});
};

module.exports = { register, verifyEmail, login, refreshToken, logout, forgotPassword, resetPassword };
