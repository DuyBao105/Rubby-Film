/**
 * Real-Time Presence & Analytics Tracker (Admin-only Insights)
 * Tracks live visitors, devices, pageviews and detailed visitor identities.
 * Powered by Neon PostgreSQL for unified cross-container synchronization on Vercel Serverless.
 */

import { neon } from "@neondatabase/serverless";

export interface ActiveSession {
  sessionId: string;
  page: string;
  title?: string;
  device: "mobile" | "desktop";
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  firstSeen: number;
  lastSeen: number;
  ipHash?: string;
}

export interface TodayVisitor {
  sessionId: string;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  device: "mobile" | "desktop";
  firstSeen: number;
  lastSeen: number;
  pageViewsCount: number;
  lastPage: string;
  lastTitle?: string;
  isOnline: boolean;
}

export interface TodayPageViewLog {
  id: string;
  sessionId: string;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  device: "mobile" | "desktop";
  page: string;
  title?: string;
  timestamp: number;
}

export interface RealtimeAnalyticsStats {
  totalActive: number;
  members: number;
  guests: number;
  devices: {
    mobile: number;
    desktop: number;
  };
  topPages: Array<{
    page: string;
    title?: string;
    count: number;
  }>;
  recentSessions: Array<{
    sessionId: string;
    page: string;
    title?: string;
    device: "mobile" | "desktop";
    userName?: string | null;
    userRole?: string | null;
    durationSeconds: number;
    lastSeenSecondsAgo: number;
  }>;
  todayStats: {
    date: string;
    pageViews: number;
    uniqueVisitors: number;
  };
  todayVisitors: TodayVisitor[];
  todayPageViewsLogs: TodayPageViewLog[];
}

function getSql() {
  const url = process.env.DATABASE_URL?.replace(/^[\uFEFF\s]+|[\uFEFF\s]+$/g, "");
  if (!url) return null;
  return neon(url);
}

// Inactivity timeout: considered offline if no heartbeat for 45 seconds (client sends every 12s)
const INACTIVITY_TIMEOUT_MS = 45 * 1000;

type StatsListener = (stats: RealtimeAnalyticsStats) => void;
const localListeners = new Set<StatsListener>();

let cachedStats: RealtimeAnalyticsStats | null = null;
let lastCacheTime = 0;
let isCleaningUp = false;

function getEmptyStats(): RealtimeAnalyticsStats {
  const vnFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return {
    totalActive: 0,
    members: 0,
    guests: 0,
    devices: { mobile: 0, desktop: 0 },
    topPages: [],
    recentSessions: [],
    todayStats: {
      date: vnFormatter.format(new Date()),
      pageViews: 0,
      uniqueVisitors: 0,
    },
    todayVisitors: [],
    todayPageViewsLogs: [],
  };
}

function notifyLocalListeners() {
  if (localListeners.size === 0) return;
  presenceTracker.getActiveStats().then((stats) => {
    for (const listener of Array.from(localListeners)) {
      try {
        listener(stats);
      } catch {
        localListeners.delete(listener);
      }
    }
  }).catch(() => {});
}

export const presenceTracker = {
  /**
   * Subscribe to real-time presence changes via SSE or local callbacks
   */
  subscribe(listener: StatsListener): () => void {
    localListeners.add(listener);
    presenceTracker.getActiveStats().then((stats) => {
      try {
        listener(stats);
      } catch {}
    }).catch(() => {});

    return () => {
      localListeners.delete(listener);
    };
  },

  /**
   * Records or updates an active heartbeat from a client in Neon PostgreSQL
   */
  async recordHeartbeat(input: {
    sessionId: string;
    page: string;
    title?: string;
    device?: "mobile" | "desktop";
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    ipHash?: string;
  }): Promise<void> {
    if (!input.sessionId) return;

    const cleanSessionId = input.sessionId.slice(0, 64);
    const now = Date.now();
    const page = (input.page || "/").slice(0, 150);
    const title = input.title ? input.title.slice(0, 100) : null;
    const device = input.device === "mobile" ? "mobile" : "desktop";
    const userId = input.userId || null;
    const userName = input.userName || null;
    const userRole = input.userRole || null;

    try {
      const sql = getSql();
      if (!sql) return;

      // 1. Check previous active session to detect page change / navigation
      const existing = (await sql.query(
        `SELECT page, first_seen FROM analytics_active_sessions WHERE session_id = $1 LIMIT 1`,
        [cleanSessionId]
      )) as Array<{ page: string; first_seen: string | number }>;

      const isNewNavigation = existing.length === 0 || existing[0].page !== page;

      // 2. If new navigation, log into analytics_pageviews
      if (isNewNavigation) {
        const pvId = `pv_${now}_${Math.random().toString(36).slice(2, 7)}`;
        await sql.query(
          `INSERT INTO analytics_pageviews (id, session_id, user_id, user_name, user_role, device, page, title, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [pvId, cleanSessionId, userId, userName, userRole, device, page, title, now]
        );
      }

      // 3. Upsert active session
      const firstSeen = existing.length > 0 ? Number(existing[0].first_seen) : now;
      await sql.query(
        `INSERT INTO analytics_active_sessions (
          session_id, user_id, user_name, user_role, device, page, title, first_seen, last_seen, page_views
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 1
        )
        ON CONFLICT (session_id) DO UPDATE SET
          user_id = COALESCE(EXCLUDED.user_id, analytics_active_sessions.user_id),
          user_name = COALESCE(EXCLUDED.user_name, analytics_active_sessions.user_name),
          user_role = COALESCE(EXCLUDED.user_role, analytics_active_sessions.user_role),
          device = EXCLUDED.device,
          page = EXCLUDED.page,
          title = COALESCE(EXCLUDED.title, analytics_active_sessions.title),
          last_seen = EXCLUDED.last_seen,
          page_views = CASE
            WHEN analytics_active_sessions.page <> EXCLUDED.page THEN analytics_active_sessions.page_views + 1
            ELSE analytics_active_sessions.page_views
          END`,
        [cleanSessionId, userId, userName, userRole, device, page, title, firstSeen, now]
      );

      // Invalidate cache so next read is immediate
      cachedStats = null;
      notifyLocalListeners();
    } catch (err) {
      console.error("[presenceTracker] recordHeartbeat error:", err);
    }
  },

  /**
   * Explicitly marks session as offline when user leaves
   */
  async removeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const cleanId = sessionId.slice(0, 64);
    try {
      const sql = getSql();
      if (!sql) return;
      await sql.query(`DELETE FROM analytics_active_sessions WHERE session_id = $1`, [cleanId]);
      cachedStats = null;
      notifyLocalListeners();
    } catch (err) {
      console.error("[presenceTracker] removeSession error:", err);
    }
  },

  /**
   * Returns aggregated real-time statistics (Only for admin)
   */
  async getActiveStats(): Promise<RealtimeAnalyticsStats> {
    const now = Date.now();

    // Serve from cache if within 1.5s TTL
    if (cachedStats && now - lastCacheTime < 1500) {
      return cachedStats;
    }

    try {
      const sql = getSql();
      if (!sql) return getEmptyStats();

      const activeCutoff = now - INACTIVITY_TIMEOUT_MS;

      // Lazy cleanup: purge sessions inactive for > 15 minutes
      if (!isCleaningUp && Math.random() < 0.05) {
        isCleaningUp = true;
        sql.query(`DELETE FROM analytics_active_sessions WHERE last_seen < $1`, [now - 15 * 60 * 1000])
          .catch(() => {})
          .finally(() => {
            isCleaningUp = false;
          });
      }

      // Vietnam date for today (Asia/Ho_Chi_Minh)
      const vnFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayDateStr = vnFormatter.format(new Date());
      const startOfDay = new Date(`${todayDateStr}T00:00:00+07:00`).getTime();

      // Parallel fetch from Neon Postgres
      const [activeRowsRaw, todaySummaryRaw, todayPvLogsRaw, todayVisitorsRaw] = await Promise.all([
        sql.query(
          `SELECT session_id, user_id, user_name, user_role, device, page, title, first_seen, last_seen, page_views
           FROM analytics_active_sessions
           WHERE last_seen >= $1
           ORDER BY last_seen DESC`,
          [activeCutoff]
        ),
        sql.query(
          `SELECT COUNT(*) as page_views_count, COUNT(DISTINCT session_id) as unique_visitors_count
           FROM analytics_pageviews
           WHERE created_at >= $1`,
          [startOfDay]
        ),
        sql.query(
          `SELECT id, session_id, user_id, user_name, user_role, device, page, title, created_at
           FROM analytics_pageviews
           WHERE created_at >= $1
           ORDER BY created_at DESC
           LIMIT 100`,
          [startOfDay]
        ),
        sql.query(
          `SELECT 
            session_id,
            MAX(user_id) as user_id,
            MAX(user_name) as user_name,
            MAX(user_role) as user_role,
            MAX(device) as device,
            MIN(created_at) as first_seen,
            MAX(created_at) as last_seen,
            COUNT(*) as page_views_count
           FROM analytics_pageviews
           WHERE created_at >= $1
           GROUP BY session_id
           ORDER BY MAX(created_at) DESC
           LIMIT 100`,
          [startOfDay]
        ),
      ]);

      const activeRows = (activeRowsRaw || []) as any[];
      const todaySummary = (todaySummaryRaw || []) as any[];
      const todayPvLogs = (todayPvLogsRaw || []) as any[];
      const todayVisitorsAgg = (todayVisitorsRaw || []) as any[];

      const activeSessionMap = new Map<string, any>();
      let members = 0;
      let guests = 0;
      let mobileCount = 0;
      let desktopCount = 0;
      const pageCountMap = new Map<string, { page: string; title?: string; count: number }>();

      for (const s of activeRows) {
        activeSessionMap.set(s.session_id, s);

        if (s.user_id) {
          members += 1;
        } else {
          guests += 1;
        }

        if (s.device === "mobile") {
          mobileCount += 1;
        } else {
          desktopCount += 1;
        }

        const pKey = s.page || "/";
        const current = pageCountMap.get(pKey);
        if (current) {
          current.count += 1;
          if (!current.title && s.title) current.title = s.title;
        } else {
          pageCountMap.set(pKey, { page: pKey, title: s.title || undefined, count: 1 });
        }
      }

      const topPages = Array.from(pageCountMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const recentSessions = activeRows.slice(0, 25).map((s) => ({
        sessionId: s.session_id.slice(0, 10) + "...",
        page: s.page || "/",
        title: s.title || undefined,
        device: s.device === "mobile" ? ("mobile" as const) : ("desktop" as const),
        userName: s.user_name || undefined,
        userRole: s.user_role || undefined,
        durationSeconds: Math.max(0, Math.floor((now - Number(s.first_seen)) / 1000)),
        lastSeenSecondsAgo: Math.max(0, Math.floor((now - Number(s.last_seen)) / 1000)),
      }));

      // Lookup map for latest page info per visitor from recent PV logs
      const latestPvPerSession = new Map<string, { page: string; title?: string }>();
      for (const pv of todayPvLogs) {
        if (!latestPvPerSession.has(pv.session_id)) {
          latestPvPerSession.set(pv.session_id, { page: pv.page, title: pv.title || undefined });
        }
      }

      // Map today visitors
      const todayVisitors: TodayVisitor[] = todayVisitorsAgg.map((v) => {
        const activeSess = activeSessionMap.get(v.session_id);
        const isOnline = !!activeSess;
        const lastPageInfo = activeSess
          ? { page: activeSess.page, title: activeSess.title }
          : latestPvPerSession.get(v.session_id) || { page: "/", title: undefined };

        return {
          sessionId: v.session_id,
          userId: v.user_id || null,
          userName: v.user_name || null,
          userRole: v.user_role || null,
          device: v.device === "mobile" ? ("mobile" as const) : ("desktop" as const),
          firstSeen: Number(v.first_seen),
          lastSeen: activeSess ? Number(activeSess.last_seen) : Number(v.last_seen),
          pageViewsCount: Number(v.page_views_count || 1),
          lastPage: lastPageInfo.page || "/",
          lastTitle: lastPageInfo.title || undefined,
          isOnline,
        };
      });

      // Map today pageview logs
      const todayPageViewsLogs: TodayPageViewLog[] = todayPvLogs.map((pv) => ({
        id: pv.id,
        sessionId: pv.session_id,
        userId: pv.user_id || null,
        userName: pv.user_name || null,
        userRole: pv.user_role || null,
        device: pv.device === "mobile" ? ("mobile" as const) : ("desktop" as const),
        page: pv.page || "/",
        title: pv.title || undefined,
        timestamp: Number(pv.created_at),
      }));

      const totalPageViews = Number(todaySummary[0]?.page_views_count || 0);
      const uniqueVisitors = Number(todaySummary[0]?.unique_visitors_count || 0);

      const statsResult: RealtimeAnalyticsStats = {
        totalActive: activeRows.length,
        members,
        guests,
        devices: {
          mobile: mobileCount,
          desktop: desktopCount,
        },
        topPages,
        recentSessions,
        todayStats: {
          date: todayDateStr,
          pageViews: totalPageViews,
          uniqueVisitors,
        },
        todayVisitors,
        todayPageViewsLogs,
      };

      cachedStats = statsResult;
      lastCacheTime = now;
      return statsResult;
    } catch (err) {
      console.error("[presenceTracker] getActiveStats error:", err);
      if (cachedStats) return cachedStats;
      return getEmptyStats();
    }
  },
};
