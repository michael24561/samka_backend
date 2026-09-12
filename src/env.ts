import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // Mercado Pago (opcional). Si no se configuran, el checkout sigue usando la
  // simulación actual y la app no se rompe.
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
  // URL pública donde Mercado Pago enviará los webhooks (en dev usar ngrok).
  mercadoPagoWebhookUrl: process.env.MERCADOPAGO_WEBHOOK_URL || "",
  // Google OAuth (opcional). Si no se configuran, no se muestra "Continuar con Google".
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  // URI de callback registrada en la consola de Google (debe coincidir exactamente).
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/auth/google/callback",
};
