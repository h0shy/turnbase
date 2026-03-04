import type { Session } from './engines/types';

const sessions = new Map<string, Session>();

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function setSession(session: Session): void {
  sessions.set(session.id, session);
}
