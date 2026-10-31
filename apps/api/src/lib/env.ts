import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env'));
} catch {
  // .env is optional; environment variables may be provided by the host.
}

function required(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  host: required('HOST', '0.0.0.0'),
  jwtSecret: required('JWT_SECRET', 'sunpower-dev-secret-change-in-production'),
  webOrigin: required('WEB_ORIGIN', 'http://localhost:3000'),
  publicApiUrl: required('PUBLIC_API_URL', 'http://localhost:4000'),
  uploadDir: path.resolve(process.cwd(), required('UPLOAD_DIR', './uploads')),
  upiId: required('UPI_ID', 'sunpower@upi'),
  upiName: required('UPI_NAME', 'SunPower Solutions'),
};

export const allowedOrigins = env.webOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
