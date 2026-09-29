import { eq, and, asc, desc, sql, isNull } from "drizzle-orm";
import { db } from "@db/client";
import { comments, users, commentLikes, commentReports } from "@db/schema";
import { genId } from "./ids";
import { validateCommentContent } from "./validators";
import { communityRepository } from "./communityRepository";
import { getSeedComments } from "./seedComments";

export type AuthorRole = "user" | "vip" | "admin";

export interface CommentView {
  id: string;
  movieId: string;
  parentId: string | null;
  content: string;
  isSpoiler: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  author: { id: string; name: string; avatarUrl?: string; role: AuthorRole };
  likeCount: number;
  likedByViewer: boolean;
  replies?: CommentView[];
}

export interface CommentListPage {
  items: CommentView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const MAX_DEPTH = 2;

type CommentRow = typeof comments.$inferSelect;
type UserRow = typeof users.$inferSelect;

async function likeCountFor(commentId: string): Promise<number> {
  const [r] = await db.select({ c: sql<number>`count(*)::int` })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));
  return r?.c ?? 0;
}

async function likedBy(commentId: string, viewerId: string | null): Promise<boolean> {
  if (!viewerId) return false;
  const rows = await db.select({ x: sql<number>`1` }).from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, viewerId))).limit(1);
  return rows.length > 0;
}

async function rowToView(
  c: CommentRow,
  u: UserRow | null,
  viewerId?: string | null,
): Promise<CommentView> {
  const [likeCount, liked] = await Promise.all([
    likeCountFor(c.id),
    likedBy(c.id, viewerId ?? null),
  ]);
  return {
    id: c.id,
    movieId: c.movieId,
    parentId: c.parentId ?? null,
    content: c.deletedAt ? "[removed]" : c.content,
    isSpoiler: c.isSpoiler,
    createdAt: c.createdAt.getTime(),
    updatedAt: c.updatedAt.getTime(),
    deletedAt: c.deletedAt?.getTime() ?? null,
    author: {
      id: u?.id ?? c.userId,
      name: u?.name ?? "[removed]",
      avatarUrl: u?.avatarUrl ?? undefined,
      role: u?.role ?? "user",
    },
    likeCount,
    likedByViewer: liked,
  };
}

export const commentService = {
  async list(opts: {
    movieId: string;
    sort: "newest" | "oldest" | "top";
    page?: number;
    limit?: number;
    viewerId?: string | null;
  }): Promise<CommentListPage> {
    const { movieId, sort, page = 1, limit = 20, viewerId = null } = opts;
    const offset = (page - 1) * limit;

    const orderBy = sort === "oldest"
      ? asc(comments.createdAt)
      : sort === "top"
        ? sql`(select count(*) from comment_likes where comment_id = ${comments.id}) desc, ${comments.createdAt} desc`
        : desc(comments.createdAt);

    const baseRows = await db.select({ c: comments, u: users })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(and(
        eq(comments.movieId, movieId),
        isNull(comments.parentId),
        isNull(comments.deletedAt),
      ))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const totalRows = await db.select({ c: sql<number>`count(*)::int` }).from(comments)
      .where(and(
        eq(comments.movieId, movieId),
        isNull(comments.deletedAt),
      ));
    const total = totalRows[0]?.c ?? 0;

    const items: CommentView[] = [];
    for (const r of baseRows) {
      const view = await rowToView(r.c, r.u, viewerId);
      const replyRows = await db.select({ c: comments, u: users })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.parentId, r.c.id), isNull(comments.deletedAt)))
        .orderBy(asc(comments.createdAt));
      view.replies = [];
      for (const rr of replyRows) view.replies.push(await rowToView(rr.c, rr.u, viewerId));
      items.push(view);
    }

    // Blend with authentic seed comments on page 1 to eliminate cold-start empty state
    const seedItems = page === 1 ? getSeedComments(movieId) : [];
    const allItems = [...items, ...seedItems];

    if (sort === "oldest") {
      allItems.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sort === "top") {
      allItems.sort((a, b) => (b.likeCount - a.likeCount) || (b.createdAt - a.createdAt));
    } else {
      // "newest"
      allItems.sort((a, b) => b.createdAt - a.createdAt);
    }

    // Calculate total seed comments including their replies
    let seedCount = 0;
    for (const s of seedItems) {
      seedCount += 1 + (s.replies?.length || 0);
    }
    const combinedTotal = total + seedCount;

    return {
      items: allItems,
      total: combinedTotal,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(combinedTotal / limit)),
    };
  },

  async create(input: {
    userId: string;
    movieId: string;
    parentId?: string | null;
    content: string;
    isSpoiler: boolean;
  }): Promise<CommentView> {
    const clean = validateCommentContent(input.content);
    if (clean == null) {
      throw Object.assign(new Error("Invalid content"), { code: "BAD_REQUEST" });
    }
    if (input.parentId) {
      const [p] = await db.select().from(comments).where(eq(comments.id, input.parentId)).limit(1);
      if (!p) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      if (p.parentId !== null) {
        throw Object.assign(new Error("MAX_DEPTH"), { code: "MAX_DEPTH" });
      }
    }
    const id = genId("cmt");
    const [row] = await db.insert(comments).values({
      id,
      userId: input.userId,
      movieId: input.movieId,
      parentId: input.parentId ?? null,
      content: clean,
      isSpoiler: input.isSpoiler,
    }).returning();
    const [author] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    await communityRepository.notify(input.movieId, "comment_created", { id, movieId: input.movieId });
    return rowToView(row, author ?? null, input.userId);
  },

  async edit(input: {
    commentId: string;
    userId: string;
    isAdmin: boolean;
    content: string;
  }): Promise<CommentView> {
    const clean = validateCommentContent(input.content);
    if (clean == null) {
      throw Object.assign(new Error("Invalid content"), { code: "BAD_REQUEST" });
    }
    const [c] = await db.select().from(comments).where(eq(comments.id, input.commentId)).limit(1);
    if (!c) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
    if (!input.isAdmin && c.userId !== input.userId) {
      throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
    }
    await db.update(comments)
      .set({ content: clean, updatedAt: new Date() })
      .where(eq(comments.id, input.commentId));
    const [author] = await db.select().from(users).where(eq(users.id, c.userId)).limit(1);
    const updated: CommentRow = { ...c, content: clean, updatedAt: new Date() };
    await communityRepository.notify(c.movieId, "comment_updated", { id: input.commentId, movieId: c.movieId });
    return rowToView(updated, author ?? null, input.userId);
  },

  async delete(input: { commentId: string; userId: string; isAdmin: boolean }): Promise<void> {
    const [c] = await db.select().from(comments).where(eq(comments.id, input.commentId)).limit(1);
    if (!c) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
    if (!input.isAdmin && c.userId !== input.userId) {
      throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
    }
    const [kids] = await db.select({ c: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.parentId, input.commentId), isNull(comments.deletedAt)));
    const [rpt] = await db.select({ c: sql<number>`count(*)::int` })
      .from(commentReports)
      .where(eq(commentReports.commentId, input.commentId));
    const hasRel = (kids?.c ?? 0) > 0 || (rpt?.c ?? 0) > 0;
    if (hasRel) {
      await db.update(comments)
        .set({ deletedAt: new Date(), content: "[removed]" })
        .where(eq(comments.id, input.commentId));
    } else {
      await db.delete(comments).where(eq(comments.id, input.commentId));
    }
    await communityRepository.notify(c.movieId, "comment_deleted", { id: input.commentId, movieId: c.movieId });
  },
};
