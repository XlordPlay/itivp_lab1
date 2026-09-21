require('dotenv').config();

const url = process.env.DATABASE_URL || '';
const ssl =
  url.includes('neon.tech') ||
  url.includes('supabase') ||
  process.env.DATABASE_SSL === 'true';

const db = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: false,
  dialectOptions: ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

module.exports = {
  development: db,
  test: db,
  production: db,
};
