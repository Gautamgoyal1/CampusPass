import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { redis } from './db/redis.js';
import { migrate } from './db/migrate.js';

const startServer = async () => {
  try {
    // Verify PostgreSQL connection
    const client = await pool.connect();
    client.release();
    console.log('PostgreSQL connected successfully');

    // Run pending database migrations
    await migrate();

    // Verify Redis connection
    await redis.ping();
    console.log('Redis ping successful');

    const server = app.listen(env.PORT, () => {
      console.log(`CampusPass API server running on port ${env.PORT} (${env.NODE_ENV})`);
      console.log(`Base URL: http://localhost:${env.PORT}/api/v1`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await pool.end();
          await redis.quit();
          console.log('Connections closed. Process exited.');
          process.exit(0);
        } catch (err) {
          console.error('Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
