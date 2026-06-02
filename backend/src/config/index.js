require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://spendigo:password@localhost:5432/spendigo_db',
  SECRET_KEY: process.env.SECRET_KEY || 'spendigo-dev-secret-key-change-in-production',
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES) || 10080, // 7 days
  FRONTEND_URL: process.env.FRONTEND_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
