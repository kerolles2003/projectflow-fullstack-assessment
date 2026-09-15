import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** Boots an isolated replica set so integration tests can use MongoDB transactions. */
export default async function globalSetup(): Promise<void> {
  const mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  (globalThis as typeof globalThis & { __MONGO_SERVER__?: MongoMemoryReplSet }).__MONGO_SERVER__ =
    mongo;

  process.env.MONGODB_URI = mongo.getUri('projectflow_test');
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.API_PORT = '4733';
}
