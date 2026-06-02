const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const verifyPassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

const createAccessToken = (userId) => {
  const expiresIn = config.ACCESS_TOKEN_EXPIRE_MINUTES * 60; // convert to seconds
  return jwt.sign(
    { sub: userId },
    config.SECRET_KEY,
    { expiresIn }
  );
};

const decodeToken = (token) => {
  try {
    return jwt.verify(token, config.SECRET_KEY);
  } catch (error) {
    return null;
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  createAccessToken,
  decodeToken,
};
