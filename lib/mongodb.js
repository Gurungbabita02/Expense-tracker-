// Cached MongoDB connection (survives Next.js hot reloads in dev)
import { MongoClient } from 'mongodb';

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Add it to .env.local');
  if (!global._mongoClient) global._mongoClient = new MongoClient(uri).connect();
  const client = await global._mongoClient;
  return client.db(process.env.MONGODB_DB || 'pocketwise');
}
