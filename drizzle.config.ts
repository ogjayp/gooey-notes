import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle/migrations',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    // Just a placeholder for drizzle-kit; runtime path comes from Electron app.getPath('userData')
    url: process.env.DATABASE_URL ?? 'file:dev.sqlite',
  },
});
