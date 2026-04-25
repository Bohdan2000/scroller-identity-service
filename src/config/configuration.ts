export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresInMs:
      parseInt(process.env.JWT_REFRESH_EXPIRES_IN_MS ?? '0', 10) ||
      7 * 24 * 60 * 60 * 1000,
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      iosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
      androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      teamId: process.env.APPLE_TEAM_ID ?? '',
      keyId: process.env.APPLE_KEY_ID ?? '',
      privateKey: process.env.APPLE_PRIVATE_KEY ?? '',
    },
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  },
});
