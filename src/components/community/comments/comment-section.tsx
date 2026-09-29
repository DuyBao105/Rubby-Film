"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";

import { useAuth } from "@/lib/auth/authContext";
import { useToast } from "@/components/ui/toast";
import { useComments, useCommentStream, useReport } from "@/hooks/use-community";
import type { CommunityEvent } from "@/lib/community/events";

import { CommentComposer } from "./comment-composer";
import { CommentList } from "./comment-list";
import { CommentSortControl, type CommentSort } from "./comment-sort";
import { ReportModal } from "./report-modal";
import type { CommentViewModel } from "./comment-item";

interface CommentSectionProps {
  movieId: string;
  initialSort?: CommentSort;
}

interface ReplyTarget {
  parentId: string;
  authorName: string;
}

export function CommentSection({ movieId, initialSort = "newest" }: CommentSectionProps) {
  const { user, openAuthModal } = useAuth();
  const toast = useToast();
  const { items, total, sort, setSort, isLoading, error, refresh, applyCreated } = useComments(movieId, initialSort);
  const { submit: submitReport } = useReport();
  const [replyTo, setReplyTo] = React.useState<ReplyTarget | null>(null);
  const [reportTarget, setReportTarget] = React.useState<string | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);

  // SSE-driven live updates: dedupe-by-id merges new comments into local tree.
  useCommentStream(
    movieId,
    React.useCallback(
      (ev: CommunityEvent) => {
        if (ev.type !== "comment_created") return;
        const payload = ev.payload as { id?: string; movieId?: string } | undefined;
        if (!payload?.id) return;
        // Fetch the freshly-created comment shape. Deduping is enforced by
        // applyCreated (RF#4 client-side guard).
        fetch(`/api/community/comments?movieId=${encodeURIComponent(movieId)}&limit=1`, {
          credentials: "include",
          cache: "no-store",
        })
          .then((r) => r.json())
          .then((j) => {
            const incoming: CommentViewModel | undefined = j?.data?.items?.find(
              (x: CommentViewModel) => x.id === payload.id,
            );
            if (incoming) applyCreated(incoming);
          })
          .catch(() => {});
        // Eventual consistency: refetch full tree every few events to converge.
        void refresh();
      },
      [applyCreated, refresh, movieId],
    ),
  );

  const submitComment = React.useCallback(
    async (input: {
      movieId: string;
      parentId?: string | null;
      content: string;
      isSpoiler: boolean;
      authorName?: string;
      isAnonymous?: boolean;
    }) => {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const j = await res.json();
      if (j?.success) return { ok: true as const, id: j.data?.id as string | undefined };
      return { ok: false as const, code: j?.error?.code, message: j?.error?.message };
    },
    [],
  );

  const handleReport = React.useCallback(
    async (commentId: string, reason: string, description: string) => {
      const r = await submitReport(commentId, reason, description);
      return { ok: r.ok, message: r.message };
    },
    [submitReport],
  );

  const notifyReport = React.useCallback(
    (result: { ok: boolean; message?: string }) => {
      if (result.ok) {
        toast.success("Đã gửi báo cáo", "Cảm ơn bạn đã giúp cộng đồng lành mạnh.");
      } else {
        toast.error("Không gửi được báo cáo", result.message ?? "Thử lại sau.");
      }
    },
    [toast],
  );

  const onSortChange = (s: CommentSort) => {
    setSort(s);
  };

  // Count exact total visible comments (top-level + all replies) or API total
  const displayTotal = React.useMemo(() => {
    const countInItems = (items as any[]).reduce(
      (acc, it) => acc + 1 + (it.replies?.length || 0),
      0
    );
    return Math.max(total, countInItems);
  }, [total, items]);

  return (
    <section
      aria-label="Bình luận"
      className="rounded-xl border border-cinema-800 bg-cinema-900/50 p-4 md:p-6 shadow-lg shadow-black/30"
    >
      <header className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-lg font-semibold text-cinema-100 flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-cinema-500" />
          <span>Bình luận</span>
          <span className="text-xs text-cinema-400 font-normal">({displayTotal})</span>
        </h2>
        <CommentSortControl value={sort} onChange={onSortChange} />
      </header>

      {/* Main Comment Composer (Open for both logged-in users and anonymous guests) */}
      <div className="mb-4">
        <CommentComposer submit={submitComment} movieId={movieId} />
      </div>

      {replyTo && (
        <div className="mb-3">
          <CommentComposer
            movieId={movieId}
            parentId={replyTo.parentId}
            parentAuthorName={replyTo.authorName}
            onCancelReply={() => setReplyTo(null)}
            onSubmitted={() => {
              setReplyTo(null);
              void refresh();
            }}
            submit={submitComment}
          />
        </div>
      )}

      <CommentList
        items={items as unknown as CommentViewModel[]}
        isLoading={isLoading}
        error={error}
        onReply={(parentId, name) => setReplyTo({ parentId, authorName: name })}
        onReportOpen={(id) => {
          setReportTarget(id);
          setReportOpen(true);
        }}
        onChanged={() => refresh()}
      />

      <ReportModal
        commentId={reportTarget}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReport}
        notify={notifyReport}
      />
    </section>
  );
}

