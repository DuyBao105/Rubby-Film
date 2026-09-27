import { EventEmitter } from "node:events";
import { getListenClient } from "./listenClient";
import { channelFor, type CommunityEvent, type CommunityEventType } from "./events";

interface State {
  emitter: EventEmitter;
  refs: Map<string, number>;
  subscribed: Set<string>;
}

const g = globalThis as unknown as { __bfilm_commRepo?: State };

function ensureState(): State {
  if (g.__bfilm_commRepo) return g.__bfilm_commRepo;
  const s: State = { emitter: new EventEmitter(), refs: new Map(), subscribed: new Set() };
  s.emitter.setMaxListeners(0);
  g.__bfilm_commRepo = s;
  return s;
}

async function ensureSubscribed(movieId: string): Promise<void> {
  const s = ensureState();
  const channel = channelFor(movieId);
  if (s.subscribed.has(channel)) return;
  const sql = getListenClient();
  await sql.listen(channel, (payload) => {
    try {
      const ev = JSON.parse(payload as string) as CommunityEvent;
      if (ev.movieId === movieId) s.emitter.emit(channelFor(movieId), ev);
    } catch {
      /* ignore malformed payloads */
    }
  });
  s.subscribed.add(channel);
}

export const communityRepository = {
  async notify(movieId: string, type: CommunityEventType, payload: unknown): Promise<void> {
    const event: CommunityEvent = { type, movieId, payload, at: Date.now() };
    const s = ensureState();
    s.emitter.emit(channelFor(movieId), event);
    if (process.env.DATABASE_URL) {
      try {
        const sql = getListenClient();
        await sql.notify(channelFor(movieId), JSON.stringify(event));
      } catch {
        /* notify fire-and-forget; local emitter already delivered */
      }
    }
  },

  async subscribe(
    movieId: string, handler: (e: CommunityEvent) => void,
  ): Promise<() => void> {
    const s = ensureState();
    const channel = channelFor(movieId);
    s.refs.set(movieId, (s.refs.get(movieId) ?? 0) + 1);
    s.emitter.on(channel, handler);
    if (process.env.DATABASE_URL) await ensureSubscribed(movieId);
    return () => {
      s.emitter.off(channel, handler);
      const next = (s.refs.get(movieId) ?? 1) - 1;
      if (next <= 0) {
        s.refs.delete(movieId);
      } else {
        s.refs.set(movieId, next);
      }
    };
  },
};
