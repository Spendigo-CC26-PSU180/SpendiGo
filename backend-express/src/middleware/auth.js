const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.SECRET_KEY);

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub }
      });

      if (!user) {
        return res.status(401).json({ detail: 'User tidak ditemukan' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ detail: 'Token tidak valid atau sudah expired' });
    }
  } catch (error) {
    return res.status(500).json({ detail: 'Internal server error' });
  }
};

module.exports = authMiddleware;
