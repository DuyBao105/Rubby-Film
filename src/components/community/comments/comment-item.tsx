"use client";

import { Heart, MessageSquareReply, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/authContext";

import { SpoilerBlock } from "./spoiler-block";
import { useLike } from "@/hooks/use-community";

export interface CommentViewModel {
  id: string;
  movieId: string;
  parentId: string | null;
  content: string;
  isSpoiler: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
    role: "user" | "vip" | "admin";
  };
  likeCount: number;
  likedByViewer: boolean;
  replies?: CommentViewModel[];
}

interface CommentItemProps {
  c: CommentViewModel;
  onReply?: (parentId: string, authorName: string) => void;
  onChanged?: () => void;
  onReportOpen: (commentId: string) => void;
  canReply?: boolean;
  depth?: 0 | 1;
}

const ROLE_LABEL: Record<"user" | "vip" | "admin", string> = {
  user: "",
  vip: "VIP",
  admin: "ADMIN",
};

function formatViTime(ts: number): string {
  return new Date(ts).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CommentItem({
  c,
  onReply,
  onChanged,
  onReportOpen,
  canReply = true,
  depth = 0,
}: CommentItemProps) {
  const { user } = useAuth();
  const liked = useLike(c.id, c.likedByViewer, c.likeCount);
  const [editing, setEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(c.content);
  const [editSpoiler, setEditSpoiler] = React.useState(c.isSpoiler);
  const [editBusy, setEditBusy] = React.useState(false);

  const isOwner = user?.id === c.author.id;
  const isAdmin = user?.role === "admin";

  const startEdit = () => {
    setEditContent(c.content);
    setEditSpoiler(c.isSpoiler);
    setEditing(true);
  };

  const saveEdit = async () => {
    const trimmed = editContent.trim();
    if (trimmed.length === 0 || trimmed.length > 1000) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/community/comments/${c.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, isSpoiler: editSpoiler }),
      });
      const j = await res.json();
      if (j?.success) {
        setEditing(false);
        onChanged?.();
      }
    } finally {
      setEditBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Xóa bình luận này?")) return;
    const res = await fetch(`/api/community/comments/${c.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await res.json();
    if (j?.success) onChanged?.();
  };

  return (
    <article
      aria-labelledby={`cmt-${c.id}-author`}
      className={cn(
        "flex gap-3 py-3 border-b border-cinema-800 last:border-b-0",
        depth === 1 && "pl-4 border-l border-l-cinema-800/70",
      )}
    >
      <Avatar
        src={c.author.avatarUrl}
        alt={c.author.name}
        fallbackInitials={c.author.name?.slice(0, 2)?.toUpperCase() ?? "?"}
        size={depth === 0 ? "md" : "sm"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span id={`cmt-${c.id}-author`} className="font-semibold text-cinema-100 truncate">
            {c.author.name}
          </span>
          {c.author.role !== "user" && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                c.author.role === "admin"
                  ? "bg-brand/20 text-brand border border-brand/40"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30",
              )}
            >
              {ROLE_LABEL[c.author.role]}
            </span>
          )}
          <time className="text-xs text-cinema-500">{formatViTime(c.createdAt)}</time>
          {c.updatedAt > c.createdAt && (
            <span className="text-[10px] text-cinema-500 italic">(đã chỉnh sửa)</span>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value.slice(0, 1000))}
              rows={3}
              className="w-full bg-cinema-950 border border-cinema-700 rounded p-2 text-sm text-cinema-100"
            />
            <label className="inline-flex items-center gap-2 text-xs text-cinema-300">
              <input
                type="checkbox"
                checked={editSpoiler}
                onChange={(e) => setEditSpoiler(e.target.checked)}
                className="accent-brand"
              />
              Chứa spoiler
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={editBusy}
                className="px-3 py-1 rounded bg-brand text-white text-xs font-semibold disabled:opacity-50"
              >
                {editBusy ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={editBusy}
                className="px-3 py-1 rounded text-cinema-300 hover:bg-cinema-800 text-xs"
              >
                Huỷ
              </button>
            </div>
          </div>
        ) : c.deletedAt ? (
          <div className="mt-1 text-sm italic text-cinema-500">[Bình luận đã xoá]</div>
        ) : (
          <div className="mt-1 text-sm text-cinema-100">
            {c.isSpoiler ? (
              <SpoilerBlock content={c.content} />
            ) : (
              <p className="whitespace-pre-wrap break-words">{c.content}</p>
            )}
          </div>
        )}

        {!editing && !c.deletedAt && (
          <div className="mt-2 flex items-center gap-3 text-xs text-cinema-400">
            <button
              type="button"
              onClick={liked.toggle}
              aria-pressed={liked.liked}
              aria-label={`Thích bình luận, hiện có ${liked.count} lượt thích`}
              className="flex items-center gap-1 hover:text-cinema-200"
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5",
                  liked.liked ? "fill-brand text-brand scale-110" : "",
                )}
              />
              <span className="tabular-nums">{liked.count}</span>
            </button>
            {canReply && user && (
              <button
                type="button"
                onClick={() => onReply?.(c.id, c.author.name)}
                className="inline-flex items-center gap-1 hover:text-cinema-200"
              >
                <MessageSquareReply className="w-3.5 h-3.5" />
                Trả lời
              </button>
            )}
            {user && !isOwner && (
              <button
                type="button"
                onClick={() => onReportOpen(c.id)}
                className="hover:text-cinema-200"
              >
                Báo cáo
              </button>
            )}
            {(isOwner || isAdmin) && (
              <>
                {isOwner && (
                  <button
                    type="button"
                    onClick={startEdit}
                    aria-label="Chỉnh sửa bình luận"
                    className="hover:text-cinema-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={remove}
                  aria-label="Xoá bình luận"
                  className="hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {isAdmin && !isOwner && (
              <span className="inline-flex items-center gap-1 text-cinema-500" title="Quản trị viên">
                <MoreHorizontal className="w-3.5 h-3.5" />
                Mod
              </span>
            )}
          </div>
        )}

        {c.replies && c.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {c.replies.map((r) => (
              <CommentItem
                key={r.id}
                c={r}
                onReply={onReply}
                onChanged={onChanged}
                onReportOpen={onReportOpen}
                canReply={false}
                depth={1}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
