import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const usesSmtpVariables = Boolean(process.env.SMTP_HOST || process.env.SMTP_FROM);
const smtpPort = Number(
  usesSmtpVariables
    ? process.env.SMTP_PORT || 587
    : process.env.EMAIL_SMTP_PORT || 587
);
const smtpFromAddress = process.env.EMAIL_FROM_ADDRESS ?? "";
const smtpFromName = process.env.EMAIL_FROM_NAME ?? "Proactif Field";

// Tests set DATABASE_URL_TEST to point Prisma at an isolated test database
// instead of DATABASE_URL (production/dev) — see apps/api/test/globalSetup.ts.
// Never set both in the same real environment; this is a test-only escape
// hatch, not a general-purpose override.
export const env = {
  databaseUrl: required(process.env.DATABASE_URL_TEST ? "DATABASE_URL_TEST" : "DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:notifications@proactif-field.fr",
  webUrl: process.env.WEB_URL ?? "http://localhost:5173",
  smtpHost: usesSmtpVariables ? process.env.SMTP_HOST ?? "" : process.env.EMAIL_SMTP_HOST ?? "",
  smtpPort,
  smtpSecure: process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : smtpPort === 465,
  smtpUser: usesSmtpVariables ? process.env.SMTP_USER ?? "" : process.env.EMAIL_SMTP_USER ?? "",
  smtpPass: usesSmtpVariables ? process.env.SMTP_PASS ?? "" : process.env.EMAIL_SMTP_PASSWORD ?? "",
  smtpFrom: usesSmtpVariables ? process.env.SMTP_FROM ?? "" : (smtpFromAddress ? `${smtpFromName} <${smtpFromAddress}>` : ""),
};
