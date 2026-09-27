import { sql } from "drizzle-orm";
import {
  pgTable, text, integer, boolean, timestamp, pgEnum,
  uniqueIndex, index, check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "vip", "admin"]);
export const authProvider = pgEnum("auth_provider", ["credentials", "google", "facebook"]);
export const reportReasonEnum = pgEnum("report_reason", ["spam", "abuse", "harassment", "inappropriate", "spoiler", "other"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewed", "dismissed", "actioned"]);

const tz = { withTimezone: true } as const;
const now = (col: string) => timestamp(col, tz).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  salt: text("salt"),
  avatarUrl: text("avatar_url"),
  role: userRole("role").notNull().default("user"),
  createdAt: now("created_at"),
});

export const authenticationIdentities = pgTable("authentication_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: authProvider("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  email: text("email"),
  createdAt: now("created_at"),
  lastUsedAt: timestamp("last_used_at", tz),
}, (t) => [
  uniqueIndex("ident_provider_account_idx").on(t.provider, t.providerAccountId),
  index("ident_user_idx").on(t.userId),
]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", tz).notNull(),
  createdAt: now("created_at"),
  lastSeenAt: now("last_seen_at"),
}, (t) => [
  index("sess_user_idx").on(t.userId),
  index("sess_expires_idx").on(t.expiresAt),
]);

export const movieRatings = pgTable("movie_ratings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: text("movie_id").notNull(),
  movieSlug: text("movie_slug").notNull(),
  rating: integer("rating").notNull(),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (t) => [
  uniqueIndex("rating_user_movie_idx").on(t.userId, t.movieId),
  index("rating_movie_idx").on(t.movieId),
  check("rating_range", sql`${t.rating} between 1 and 5`),
]);

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: text("movie_id").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isSpoiler: boolean("is_spoiler").notNull().default(false),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
  deletedAt: timestamp("deleted_at", tz),
}, (t) => [
  index("cmt_movie_created_idx").on(t.movieId, t.createdAt),
  index("cmt_parent_idx").on(t.parentId),
  index("cmt_user_idx").on(t.userId),
  check("cmt_len", sql`char_length(${t.content}) between 1 and 1000`),
]);

export const commentLikes = pgTable("comment_likes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  createdAt: now("created_at"),
}, (t) => [
  uniqueIndex("like_user_comment_idx").on(t.userId, t.commentId),
  index("like_comment_idx").on(t.commentId),
]);

export const commentReports = pgTable("comment_reports", {
  id: text("id").primaryKey(),
  reporterUserId: text("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: text("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  status: reportStatusEnum("status").notNull().default("open"),
  createdAt: now("created_at"),
}, (t) => [
  uniqueIndex("rpt_reporter_comment_idx").on(t.reporterUserId, t.commentId),
  index("rpt_status_created_idx").on(t.status, t.createdAt),
  index("rpt_comment_idx").on(t.commentId),
]);
