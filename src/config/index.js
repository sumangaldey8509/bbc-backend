const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'BBC - Bengal Business Council <noreply@bengalbusinesscouncil.com>',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  otp: {
    expiryMinutes: 2,
    length: 6,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    // Base/project folder. Per-user uploads land in `<folder>/users/<user-slug>`.
    folder: process.env.CLOUDINARY_FOLDER || 'bbc',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },
};

config.cloudinary.configured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

module.exports = config;
