export const TWITTER_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID || "",
  clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
  callbackUrl:
    process.env.NEXT_PUBLIC_TWITTER_CALLBACK_URL ||
    "http://localhost:3000/api/auth/twitter/callback",
};
