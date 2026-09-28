import { EventEmitter } from "node:events";
import { getListenClient } from "./listenClient";
import { channelFor, type CommunityEvent, type CommunityEventType } from "./events";

interface State {
  emitter: EventEmitter;
  refs: Map<string, number>;
  subscribed: Set<string>;
}

const g = globalThis as unknown as { __bfilm_commRepo?: State };

const MOD_CHANNEL = "channel_moderation";

export type ModerationEventType = "report.created" | "report.updated";
export interface ModerationEvent {
  type: ModerationEventType;
  payload: { id: string; status?: string; reason?: string };
  at: number;
}

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

async function ensureModerationSubscribed(): Promise<void> {
  const s = ensureState();
  if (s.subscribed.has(MOD_CHANNEL)) return;
  const sql = getListenClient();
  await sql.listen(MOD_CHANNEL, (payload) => {
    try {
      const ev = JSON.parse(payload as string) as ModerationEvent;
      s.emitter.emit(MOD_CHANNEL, ev);
    } catch {
      /* ignore malformed payloads */
    }
  });
  s.subscribed.add(MOD_CHANNEL);
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

  async notifyModeration(type: ModerationEventType, payload: ModerationEvent["payload"]): Promise<void> {
    const event: ModerationEvent = { type, payload, at: Date.now() };
    const s = ensureState();
    s.emitter.emit(MOD_CHANNEL, event);
    if (process.env.DATABASE_URL) {
      try {
        const sql = getListenClient();
        await sql.notify(MOD_CHANNEL, JSON.stringify(event));
      } catch {
        /* notify fire-and-forget; local emitter already delivered */
      }
    }
  },

  async subscribeModeration(handler: (e: ModerationEvent) => void): Promise<() => void> {
    const s = ensureState();
    const key = "__moderation__";
    s.refs.set(key, (s.refs.get(key) ?? 0) + 1);
    s.emitter.on(MOD_CHANNEL, handler);
    if (process.env.DATABASE_URL) await ensureModerationSubscribed();
    return () => {
      s.emitter.off(MOD_CHANNEL, handler);
      const next = (s.refs.get(key) ?? 1) - 1;
      if (next <= 0) s.refs.delete(key);
      else s.refs.set(key, next);
    };
  },
};
