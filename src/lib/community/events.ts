export type CommunityEventType =
  | "rating_upserted"
  | "rating_deleted"
  | "comment_created"
  | "comment_updated"
  | "comment_deleted"
  | "like_changed"
  | "report_created";

export interface CommunityEvent {
  type: CommunityEventType;
  movieId: string;
  payload: unknown;
  at: number;
}

export function channelFor(movieId: string): string {
  return `channel_movie_${movieId}`;
}
