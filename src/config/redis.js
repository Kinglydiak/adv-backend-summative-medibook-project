const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (error) => {
  console.warn('Redis warning:', error.message);
});

async function ensureRedisConnection() {
  if (!client.isOpen) {
    await client.connect();
  }
}

module.exports = { client, ensureRedisConnection };
