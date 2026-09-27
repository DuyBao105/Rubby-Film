import { eq, and, sql } from "drizzle-orm";
import { db } from "@db/client";
import { commentLikes, comments } from "@db/schema";
import { genId } from "./ids";
import { communityRepository } from "./communityRepository";

export const likeService = {
  async toggle({ userId, commentId }: { userId: string; commentId: string }): Promise<{ liked: boolean; count: number }> {
    const [existing] = await db.select({ id: commentLikes.id }).from(commentLikes)
      .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId))).limit(1);
    let liked: boolean;
    if (existing) {
      await db.delete(commentLikes).where(eq(commentLikes.id, existing.id));
      liked = false;
    } else {
      await db.insert(commentLikes).values({ id: genId("like"), userId, commentId }).onConflictDoNothing();
      liked = true;
    }
    const [c] = await db.select({ c: sql<number>`count(*)::int` }).from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));
    const count = c?.c ?? 0;
    const [cmt] = await db.select({ movieId: comments.movieId }).from(comments)
      .where(eq(comments.id, commentId)).limit(1);
    if (cmt) {
      await communityRepository.notify(cmt.movieId, "like_changed", { commentId, liked, count });
    }
    return { liked, count };
  },
};