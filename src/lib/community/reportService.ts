import { eq, and, sql, desc, asc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@db/client";
import { commentReports, comments, users } from "@db/schema";
import { genId } from "./ids";
import { validateReportReason, validateDescription, type ReportReason } from "./validators";

export type ReportStatus = "open" | "reviewed" | "dismissed" | "actioned";
export type ReportSort = "newest" | "oldest";

export interface ReportView {
  id: string;
  commentId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: number;
  reporter: { id: string; name: string };
  comment: {
    id: string;
    content: string;
    movieId: string;
    isSpoiler: boolean;
    authorId: string;
    authorName: string;
    authorAvatarUrl: string | null;
  };
}

export interface ReportListPage {
  items: ReportView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportStatusCounts {
  open: number;
  reviewed: number;
  dismissed: number;
  actioned: number;
  total: number;
}

const authorUser = alias(users, "author_user");

async function assertAdmin(adminId: string): Promise<void> {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, adminId)).limit(1);
  if (!u || u.role !== "admin") {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
}

export const reportService = {
  async create(input: {
    reporterUserId: string;
    commentId: string;
    reason: string;
    description?: string | null;
  }): Promise<{ id: string }> {
    const reason = validateReportReason(input.reason);
    if (reason == null) {
      throw Object.assign(new Error("Invalid reason"), { code: "BAD_REQUEST" });
    }
    const desc = validateDescription(input.description ?? null);
    const [c] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, input.commentId)).limit(1);
    if (!c) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
    const [existing] = await db.select({ id: commentReports.id }).from(commentReports)
      .where(and(eq(commentReports.reporterUserId, input.reporterUserId), eq(commentReports.commentId, input.commentId))).limit(1);
    if (existing) {
      throw Object.assign(new Error("ALREADY_REPORTED"), { code: "ALREADY_REPORTED" });
    }
    const id = genId("rpt");
    await db.insert(commentReports).values({
      id,
      reporterUserId: input.reporterUserId,
      commentId: input.commentId,
      reason,
      description: desc,
    });
    return { id };
  },

  async list(opts: {
    adminId: string;
    status?: ReportStatus;
    reason?: ReportReason;
    sort?: ReportSort;
    page?: number;
    limit?: number;
  }): Promise<ReportListPage> {
    await assertAdmin(opts.adminId);
    const { status, reason, sort = "newest", page = 1, limit = 20 } = opts;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(commentReports.status, status));
    if (reason) conditions.push(eq(commentReports.reason, reason));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderClause = sort === "oldest" ? asc(commentReports.createdAt) : desc(commentReports.createdAt);

    const baseRows = await db.select({
      r: commentReports,
      reporter: users,
      c: comments,
      author: authorUser,
    })
      .from(commentReports)
      .leftJoin(users, eq(commentReports.reporterUserId, users.id))
      .leftJoin(comments, eq(commentReports.commentId, comments.id))
      .leftJoin(authorUser, eq(comments.userId, authorUser.id))
      .where(where)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    const totalRows = await db.select({ c: sql<number>`count(*)::int` }).from(commentReports).where(where);
    const total = totalRows[0]?.c ?? 0;

    const items: ReportView[] = baseRows.map((row) => ({
      id: row.r.id,
      commentId: row.r.commentId,
      reason: row.r.reason as ReportReason,
      description: row.r.description ?? null,
      status: row.r.status as ReportStatus,
      createdAt: row.r.createdAt.getTime(),
      reporter: { id: row.reporter?.id ?? row.r.reporterUserId, name: row.reporter?.name ?? "[removed]" },
      comment: {
        id: row.c?.id ?? row.r.commentId,
        content: row.c?.content ?? "[removed]",
        movieId: row.c?.movieId ?? "",
        isSpoiler: row.c?.isSpoiler ?? false,
        authorId: row.c?.userId ?? "",
        authorName: row.author?.name ?? "[removed]",
        authorAvatarUrl: row.author?.avatarUrl ?? null,
      },
    }));

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async counts(opts: { adminId: string }): Promise<ReportStatusCounts> {
    await assertAdmin(opts.adminId);
    const rows = await db
      .select({ status: commentReports.status, c: sql<number>`count(*)::int` })
      .from(commentReports)
      .groupBy(commentReports.status);
    const out: ReportStatusCounts = { open: 0, reviewed: 0, dismissed: 0, actioned: 0, total: 0 };
    for (const r of rows) {
      if (r.status === "open" || r.status === "reviewed" || r.status === "dismissed" || r.status === "actioned") {
        out[r.status] = r.c;
        out.total += r.c;
      } else {
        out.total += r.c;
      }
    }
    return out;
  },

  async updateStatus(input: {
    reportId: string;
    adminId: string;
    status: ReportStatus;
  }): Promise<void> {
    await assertAdmin(input.adminId);
    const valid: ReportStatus[] = ["open", "reviewed", "dismissed", "actioned"];
    if (!valid.includes(input.status)) {
      throw Object.assign(new Error("Invalid status"), { code: "BAD_REQUEST" });
    }
    const [r] = await db.select({ id: commentReports.id }).from(commentReports)
      .where(eq(commentReports.id, input.reportId)).limit(1);
    if (!r) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
    await db.update(commentReports).set({ status: input.status }).where(eq(commentReports.id, input.reportId));
  },
};