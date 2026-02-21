import { defineConfig } from '@prisma/cli';

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
    },
  },
});
