"use client";

import * as React from "react";
import { Send, AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/authContext";

const MAX_LEN = 1000;

interface CommentComposerProps {
  /** Parent to reply to, if this composer is being used in reply mode. */
  parentId?: string | null;
  parentAuthorName?: string;
  onCancelReply?: () => void;
  onSubmitted?: (created: { id: string }) => void;
  /** Mutation posted to /api/community/comments. Returns success and a comment id. */
  submit: (input: {
    movieId: string;
    parentId?: string | null;
    content: string;
    isSpoiler: boolean;
  }) => Promise<{ ok: boolean; id?: string; code?: string; message?: string }>;
  movieId: string;
}

export function CommentComposer({
  parentId,
  parentAuthorName,
  onCancelReply,
  onSubmitted,
  submit,
  movieId,
}: CommentComposerProps) {
  const { user, openAuthModal } = useAuth();
  const [content, setContent] = React.useState("");
  const [isSpoiler, setIsSpoiler] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = content.trim();
  const tooLong = trimmed.length > MAX_LEN;
  const disabled = busy || trimmed.length === 0 || tooLong;

  const send = React.useCallback(async () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (disabled) return;
    setBusy(true);
    setError(null);
    const r = await submit({
      movieId,
      parentId: parentId ?? null,
      content: trimmed,
      isSpoiler,
    });
    setBusy(false);
    if (r.ok) {
      setContent("");
      setIsSpoiler(false);
      onSubmitted?.({ id: r.id! });
    } else {
      if (r.code === "UNAUTHENTICATED") openAuthModal("login");
      else setError(r.message ?? "Không gửi được bình luận.");
    }
  }, [user, disabled, submit, movieId, parentId, trimmed, isSpoiler, openAuthModal, onSubmitted]);

  return (
    <div
      className={cn(
        "rounded-xl border border-cinema-800 bg-cinema-900/50 p-3 sm:p-4",
        parentId ? "ml-6 border-l-2 border-l-cinema-700" : "",
      )}
    >
      {parentId && parentAuthorName && (
        <div className="flex items-center justify-between mb-2 text-xs text-cinema-400">
          <span>
            Trả lời <strong className="text-cinema-200">@{parentAuthorName}</strong>
          </span>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="inline-flex items-center gap-1 hover:text-cinema-200"
              aria-label="Huỷ trả lời"
            >
              <X className="w-3.5 h-3.5" />
              Huỷ
            </button>
          )}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
        placeholder={user ? "Chia sẻ cảm nhận của bạn về phim..." : "Đăng nhập để bình luận"}
        disabled={!user}
        rows={3}
        maxLength={MAX_LEN}
        className={cn(
          "w-full bg-cinema-950 border border-cinema-800 rounded-lg p-3 text-sm text-cinema-100",
          "placeholder:text-cinema-500 resize-y min-h-[72px] max-h-48",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-cinema-500",
          !user && "opacity-70 cursor-not-allowed",
        )}
      />
      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <label className="inline-flex items-center gap-2 text-xs text-cinema-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSpoiler}
            onChange={(e) => setIsSpoiler(e.target.checked)}
            className="accent-brand"
          />
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Chứa spoiler</span>
        </label>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-[11px] tabular-nums",
              tooLong ? "text-red-400" : "text-cinema-400",
            )}
            aria-live="polite"
          >
            {trimmed.length}/{MAX_LEN}
          </span>
          {error && (
            <span className="text-xs text-red-400" role="alert">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={send}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold",
              "bg-brand text-white hover:bg-[#FF1A1A] disabled:opacity-50 disabled:cursor-not-allowed",
              "shadow-sm shadow-brand/30",
            )}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{busy ? "Đang gửi..." : parentId ? "Trả lời" : "Bình luận"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
