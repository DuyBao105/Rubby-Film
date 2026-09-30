/**
 * Real-Time Presence & Analytics Tracker (Admin-only Insights)
 * Tracks live visitors, devices, pageviews and detailed visitor identities.
 * Supports Sub-second Real-time Server-Sent Events (SSE) broadcasting.
 */

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

type StatsListener = (stats: RealtimeAnalyticsStats) => void;

interface PresenceState {
  sessions: Map<string, ActiveSession>;
  todayVisitors: Map<string, TodayVisitor>;
  todayPageViewsLogs: TodayPageViewLog[];
  todayDate: string;
  todayPageViews: number;
  listeners: Set<StatsListener>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

const GLOBAL_PRESENCE_KEY = "__rubbyfilm_presence_state_v2__";

function getPresenceState(): PresenceState {
  const g = globalThis as unknown as { [GLOBAL_PRESENCE_KEY]?: PresenceState };
  const todayStr = new Date().toISOString().split("T")[0];

  if (!g[GLOBAL_PRESENCE_KEY]) {
    g[GLOBAL_PRESENCE_KEY] = {
      sessions: new Map<string, ActiveSession>(),
      todayVisitors: new Map<string, TodayVisitor>(),
      todayPageViewsLogs: [],
      todayDate: todayStr,
      todayPageViews: 0,
      listeners: new Set<StatsListener>(),
      debounceTimer: null,
    };
  }

  const state = g[GLOBAL_PRESENCE_KEY]!;

  if (!state.sessions) {
    state.sessions = new Map<string, ActiveSession>();
  }
  if (!state.todayVisitors) {
    state.todayVisitors = new Map<string, TodayVisitor>();
  }
  if (!state.todayPageViewsLogs) {
    state.todayPageViewsLogs = [];
  }
  if (!state.listeners) {
    state.listeners = new Set<StatsListener>();
  }

  // Reset daily stats on date change
  if (state.todayDate !== todayStr) {
    state.todayDate = todayStr;
    state.todayPageViews = 0;
    state.todayVisitors.clear();
    state.todayPageViewsLogs = [];
  }

  return state;
}

// Inactivity timeout: considered offline if no heartbeat for 25 seconds
const INACTIVITY_TIMEOUT_MS = 25 * 1000;

function notifyListeners() {
  const state = getPresenceState();
  if (state.listeners.size === 0) return;

  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
  }

  // Debounce notification by 50ms to batch rapid events
  state.debounceTimer = setTimeout(() => {
    state.debounceTimer = null;
    const stats = presenceTracker.getActiveStats();
    for (const listener of state.listeners) {
      try {
        listener(stats);
      } catch (err) {
        state.listeners.delete(listener);
      }
    }
  }, 50);
}

export const presenceTracker = {
  /**
   * Subscribe to real-time presence changes via SSE or callbacks
   */
  subscribe(listener: StatsListener): () => void {
    const state = getPresenceState();
    state.listeners.add(listener);
    try {
      listener(presenceTracker.getActiveStats());
    } catch {}

    return () => {
      state.listeners.delete(listener);
    };
  },

  /**
   * Records or updates an active heartbeat from a client
   */
  recordHeartbeat(input: {
    sessionId: string;
    page: string;
    title?: string;
    device?: "mobile" | "desktop";
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    ipHash?: string;
  }) {
    if (!input.sessionId) return;

    const state = getPresenceState();
    const now = Date.now();
    const cleanSessionId = input.sessionId.slice(0, 64);
    const existingSession = state.sessions.get(cleanSessionId);
    const existingVisitor = state.todayVisitors.get(cleanSessionId);

    const isNewNavigation = !existingSession || existingSession.page !== (input.page || "/");

    // Only increment pageviews on new visitor or navigation to a new page
    if (isNewNavigation) {
      state.todayPageViews += 1;

      // Log pageview event (limit to last 200 events)
      state.todayPageViewsLogs.unshift({
        id: `pv_${now}_${Math.random().toString(36).slice(2, 6)}`,
        sessionId: cleanSessionId,
        userId: input.userId || null,
        userName: input.userName || null,
        userRole: input.userRole || null,
        device: input.device === "mobile" ? "mobile" : "desktop",
        page: input.page || "/",
        title: input.title ? input.title.slice(0, 100) : undefined,
        timestamp: now,
      });

      if (state.todayPageViewsLogs.length > 200) {
        state.todayPageViewsLogs.pop();
      }
    }

    // Update or insert visitor in today's visitor registry
    state.todayVisitors.set(cleanSessionId, {
      sessionId: cleanSessionId,
      userId: input.userId || existingVisitor?.userId || null,
      userName: input.userName || existingVisitor?.userName || null,
      userRole: input.userRole || existingVisitor?.userRole || null,
      device: input.device === "mobile" ? "mobile" : "desktop",
      firstSeen: existingVisitor ? existingVisitor.firstSeen : now,
      lastSeen: now,
      pageViewsCount: (existingVisitor?.pageViewsCount || 0) + (isNewNavigation ? 1 : 0),
      lastPage: input.page || "/",
      lastTitle: input.title || existingVisitor?.lastTitle,
      isOnline: true,
    });

    // Update active session
    state.sessions.set(cleanSessionId, {
      sessionId: cleanSessionId,
      page: input.page || "/",
      title: input.title ? input.title.slice(0, 100) : undefined,
      device: input.device === "mobile" ? "mobile" : "desktop",
      userId: input.userId || null,
      userName: input.userName || null,
      userRole: input.userRole || null,
      firstSeen: existingSession ? existingSession.firstSeen : now,
      lastSeen: now,
      ipHash: input.ipHash,
    });

    notifyListeners();
  },

  /**
   * Explicitly marks session as offline when user leaves
   */
  removeSession(sessionId: string) {
    if (!sessionId) return;
    const state = getPresenceState();
    const cleanId = sessionId.slice(0, 64);
    const deleted = state.sessions.delete(cleanId);

    const visitor = state.todayVisitors.get(cleanId);
    if (visitor) {
      visitor.isOnline = false;
    }

    if (deleted) {
      notifyListeners();
    }
  },

  /**
   * Returns aggregated real-time statistics (Only for admin)
   */
  getActiveStats(): RealtimeAnalyticsStats {
    const state = getPresenceState();
    const now = Date.now();

    // 1. Purge stale sessions
    for (const [id, session] of state.sessions.entries()) {
      if (now - session.lastSeen > INACTIVITY_TIMEOUT_MS) {
        state.sessions.delete(id);
        const visitor = state.todayVisitors.get(id);
        if (visitor) visitor.isOnline = false;
      }
    }

    const activeList = Array.from(state.sessions.values());

    let members = 0;
    let guests = 0;
    let mobileCount = 0;
    let desktopCount = 0;

    const pageCountMap = new Map<string, { page: string; title?: string; count: number }>();

    for (const s of activeList) {
      if (s.userId) {
        members += 1;
      } else {
        guests += 1;
      }

      if (s.device === "mobile") {
        mobileCount += 1;
      } else {
        desktopCount += 1;
      }

      const pKey = s.page;
      const current = pageCountMap.get(pKey);
      if (current) {
        current.count += 1;
        if (!current.title && s.title) current.title = s.title;
      } else {
        pageCountMap.set(pKey, { page: pKey, title: s.title, count: 1 });
      }
    }

    // Top active pages sorted by active viewer count
    const topPages = Array.from(pageCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent active sessions (up to 25)
    const recentSessions = activeList
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 25)
      .map((s) => ({
        sessionId: s.sessionId.slice(0, 10) + "...",
        page: s.page,
        title: s.title,
        device: s.device,
        userName: s.userName,
        userRole: s.userRole,
        durationSeconds: Math.max(0, Math.floor((now - s.firstSeen) / 1000)),
        lastSeenSecondsAgo: Math.max(0, Math.floor((now - s.lastSeen) / 1000)),
      }));

    // Today's visitors list sorted by lastSeen desc
    const todayVisitorsList = Array.from(state.todayVisitors.values())
      .map((v) => ({
        ...v,
        isOnline: now - v.lastSeen <= INACTIVITY_TIMEOUT_MS,
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen);

    return {
      totalActive: activeList.length,
      members,
      guests,
      devices: {
        mobile: mobileCount,
        desktop: desktopCount,
      },
      topPages,
      recentSessions,
      todayStats: {
        date: state.todayDate,
        pageViews: state.todayPageViews,
        uniqueVisitors: state.todayVisitors.size,
      },
      todayVisitors: todayVisitorsList,
      todayPageViewsLogs: state.todayPageViewsLogs.slice(0, 100),
    };
  },
};
