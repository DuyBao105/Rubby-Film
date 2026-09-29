import { CommentView } from "./commentService";

// Pool of authentic Vietnamese names and diverse avatars
const SEED_PROFILES = [
  {
    name: "Minh Quân",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
    role: "vip" as const,
  },
  {
    name: "Khánh Linh",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Hoàng Long",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=face",
    role: "vip" as const,
  },
  {
    name: "Bảo Trâm",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Đức Huy",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Ngọc Mai",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    role: "vip" as const,
  },
  {
    name: "Quốc Bảo",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Thùy Dương",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Hải Đăng",
    avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop&crop=face",
    role: "vip" as const,
  },
  {
    name: "Thanh Thảo",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Gia Bách",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Phương Uyên",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face",
    role: "vip" as const,
  },
  {
    name: "Thành Đạt",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
  {
    name: "Thu Hà",
    avatarUrl: "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=100&h=100&fit=crop&crop=face",
    role: "user" as const,
  },
];

// Pool of organic, realistic Vietnamese movie reviews
const SEED_COMMENT_TEMPLATES = [
  {
    content: "Server Ruby VIP load nhanh mượt không giật lag tí nào, 10 điểm cho chất lượng Full HD!",
    reply: "Công nhận bạn ơi, xem trên màn hình lớn nét căng luôn.",
    replyAuthorIndex: 1,
  },
  {
    content: "Phim cuốn thật sự, xem một lèo hết luôn không dứt ra được. Diễn xuất của dàn cast quá đỉnh!",
    reply: "Đoạn cao trào xem mà nổi cả da gà luôn bác ạ.",
    replyAuthorIndex: 4,
  },
  {
    content: "Bản Vietsub dịch mượt mà, câu từ tự nhiên dễ hiểu ghê. Cảm ơn subteam và ad nhiều nha ❤️",
    reply: null,
    replyAuthorIndex: null,
  },
  {
    content: "Kịch bản xuất sắc, đoạn kết quay xe bất ngờ không đoán trước được luôn 👏 Rất đáng để xem!",
    reply: "Chuẩn luôn, kết phim làm mình suy ngẫm mãi.",
    replyAuthorIndex: 6,
  },
  {
    content: "Âm thanh với hình ảnh đỉnh thật sự, nhất là mấy đoạn nhạc nền lồng vào quá hợp cảnh luôn.",
    reply: null,
    replyAuthorIndex: null,
  },
  {
    content: "Ai còn đang phân vân thì nên xem ngay đi nhé, cá nhân mình chấm 9.5/10 cực kỳ xứng đáng.",
    reply: "Xem xong đọng lại nhiều cảm xúc ghê bạn.",
    replyAuthorIndex: 7,
  },
  {
    content: "Dàn diễn viên diễn xuất thần, ánh mắt biểu cảm đỉnh của chóp. Xem mà nhập tâm theo nhân vật luôn.",
    reply: null,
    replyAuthorIndex: null,
  },
  {
    content: "Phim hay vượt mong đợi luôn á, có lịch chiếu tập mới nhớ cập nhật sớm nhé ad ơi!",
    reply: "Hóng cùng bạn nè, nghe bảo lịch chiếu tuần này có tập mới.",
    replyAuthorIndex: 9,
  },
  {
    content: "Tình tiết nhanh, gay cấn hồi hộp từng phút. Web xem mượt mà không bị quảng cáo làm phiền, thích thật.",
    reply: null,
    replyAuthorIndex: null,
  },
  {
    content: "Một trong những bộ phim ấn tượng nhất dạo gần đây mình xem. Chúc web ngày càng phát triển nhé ad!",
    reply: "Cảm ơn bạn đã đồng hành cùng RubyFilm nhé!",
    replyAuthorIndex: 0,
  },
];

/** Deterministic hash for string */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns 3 to 4 natural, deterministic seed comments for any movie
 */
export function getSeedComments(movieId: string): CommentView[] {
  const hash = hashString(movieId);
  const now = Date.now();

  // Number of comments: 3 or 4
  const count = 3 + (hash % 2);
  const comments: CommentView[] = [];

  for (let i = 0; i < count; i++) {
    const templateIndex = (hash + i * 3) % SEED_COMMENT_TEMPLATES.length;
    const authorIndex = (hash + i * 2) % SEED_PROFILES.length;

    const template = SEED_COMMENT_TEMPLATES[templateIndex];
    const author = SEED_PROFILES[authorIndex];

    // Timestamps spread over the last 1 to 4 days
    const hoursAgo = 2 + ((hash + i * 7) % 72);
    const createdAt = now - hoursAgo * 3600 * 1000;
    const commentId = `seed-${movieId}-${i + 1}`;

    const replies: CommentView[] = [];
    if (template.reply && template.replyAuthorIndex !== null) {
      const replyAuthor =
        SEED_PROFILES[(authorIndex + 1 + (template.replyAuthorIndex % 5)) % SEED_PROFILES.length];
      replies.push({
        id: `seed-rep-${movieId}-${i + 1}`,
        movieId,
        parentId: commentId,
        content: template.reply,
        isSpoiler: false,
        createdAt: createdAt + 35 * 60 * 1000, // 35 minutes later
        updatedAt: createdAt + 35 * 60 * 1000,
        deletedAt: null,
        author: {
          id: `seed-usr-${replyAuthor.name}`,
          name: replyAuthor.name,
          avatarUrl: replyAuthor.avatarUrl,
          role: replyAuthor.role,
        },
        likeCount: 2 + ((hash + i) % 6),
        likedByViewer: false,
      });
    }

    comments.push({
      id: commentId,
      movieId,
      parentId: null,
      content: template.content,
      isSpoiler: false,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      author: {
        id: `seed-usr-${author.name}`,
        name: author.name,
        avatarUrl: author.avatarUrl,
        role: author.role,
      },
      likeCount: 5 + ((hash + i * 5) % 24),
      likedByViewer: false,
      replies: replies.length > 0 ? replies : undefined,
    });
  }

  // Sort by createdAt desc
  return comments.sort((a, b) => b.createdAt - a.createdAt);
}
