const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { hashPassword, verifyPassword, createAccessToken } = require('../utils/security');
const authMiddleware = require('../middleware/auth');

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password, full_name } = req.body;

    // Validate required fields
    if (!email || !username || !password) {
      return res.status(400).json({ detail: 'Email, username, dan password wajib diisi' });
    }

    // Check if email exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ detail: 'Email sudah terdaftar' });
    }

    // Check if username exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ detail: 'Username sudah digunakan' });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        hashedPassword,
        fullName: full_name || null,
      },
    });

    // Create token
    const accessToken = createAccessToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.fullName,
        created_at: user.createdAt,
      },
      access_token: accessToken,
      token_type: 'bearer',
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ detail: 'Email dan password wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.hashedPassword))) {
      return res.status(401).json({ detail: 'Email atau password salah' });
    }

    const accessToken = createAccessToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.fullName,
        created_at: user.createdAt,
      },
      access_token: accessToken,
      token_type: 'bearer',
    });
  } catch (error) {
    next(error);
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    username: req.user.username,
    full_name: req.user.fullName,
    created_at: req.user.createdAt,
  });
});

module.exports = router;
