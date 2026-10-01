Object.assign(process.env, { NODE_ENV: "test" });
process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:55432/voces_test";
process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-test-better-auth-secret";
process.env.QR_SIGNING_SECRET ??= "test-qr-signing-secret-test-qr-signing-secret";
process.env.CRON_SECRET ??= "test-cron-secret-test";
process.env.PRIVATE_UPLOAD_DIR ??= "/tmp/voces-test-uploads";
