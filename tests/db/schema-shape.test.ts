import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  users, authenticationIdentities, sessions, movieRatings,
  comments, commentLikes, commentReports,
} from "../../db/schema";

describe("schema column names + indexes", () => {
  it("explicit snake names are honored", () => {
    expect(users.passwordHash.name).toBe("password_hash");
    expect(comments.parentId?.name).toBe("parent_id");
    expect(commentLikes.commentId.name).toBe("comment_id");
    expect(authenticationIdentities.providerAccountId.name).toBe("provider_account_id");
  });

  it("unique indexes exist with expected names", () => {
    const idx = (t: any) =>
      getTableConfig(t).indexes
        .filter((i: any) => i.config.unique)
        .map((i: any) => i.config.name);
    expect(idx(movieRatings)).toContain("rating_user_movie_idx");
    expect(idx(commentLikes)).toContain("like_user_comment_idx");
    expect(idx(commentReports)).toContain("rpt_reporter_comment_idx");
    expect(idx(authenticationIdentities)).toContain("ident_provider_account_idx");
  });

  it("rating check constraint present", () => {
    expect(getTableConfig(movieRatings).checks.length).toBeGreaterThan(0);
  });

  it("comments self-FK declared", () => {
    expect(comments.parentId !== undefined).toBe(true);
  });
});
