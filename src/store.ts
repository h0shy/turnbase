import { Redis } from '@upstash/redis';
import type { Session } from './engines/types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const KEY = (id: string) => `session:${id}`;

export async function getSession(id: string): Promise<Session | null> {
  return redis.get<Session>(KEY(id));
}

export async function setSession(session: Session): Promise<void> {
  await redis.set(KEY(session.id), session);
}
