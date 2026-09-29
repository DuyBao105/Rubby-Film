"use client";

import * as React from "react";
import { Plus, Minus, HelpCircle } from "lucide-react";

interface FaqItem {
  id: string;
  number: string;
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    id: "faq-1",
    number: "01",
    question: "RubyFilm là gì?",
    answer:
      "RubyFilm là nền tảng xem phim trực tuyến miễn phí chất lượng cao, cung cấp hàng ngàn tác phẩm điện ảnh bom tấn chiếu rạp, phim bộ đặc sắc (Hàn Quốc, Trung Quốc, Âu Mỹ, Thái Lan) và anime thịnh hành. Giao diện được thiết kế hiện đại, mượt mà và tối ưu hóa hiển thị sắc nét trên cả máy tính lẫn điện thoại.",
  },
  {
    id: "faq-2",
    number: "02",
    question: "Tôi có cần phải đăng nhập hoặc đăng ký tài khoản không?",
    answer:
      "Bạn KHÔNG bắt buộc phải có tài khoản để xem phim – có thể bấm xem ngay lập tức mọi tác phẩm. Tuy nhiên, việc đăng ký tài khoản (hỗ trợ đăng nhập nhanh bằng Google) sẽ giúp bạn đồng bộ Lịch sử xem và Danh sách yêu thích giữa máy tính và điện thoại, đồng thời có thể tham gia bình luận thảo luận cùng cộng đồng.",
  },
  {
    id: "faq-3",
    number: "03",
    question: "Làm thế nào để lưu phim yêu thích và xem tiếp trên thiết bị khác?",
    answer:
      "Nếu xem không đăng nhập, RubyFilm tự động lưu tiến trình và danh sách yêu thích ngay trên bộ nhớ trình duyệt của máy bạn. Khi bạn đăng nhập tài khoản, toàn bộ lịch sử xem (kèm thời lượng chính xác đến từng giây) sẽ được đồng bộ đám mây (Cloud Sync) giúp bạn đổi từ điện thoại sang máy tính vẫn xem tiếp đúng tập và giây đã dừng.",
  },
  {
    id: "faq-4",
    number: "04",
    question: "Chất lượng hình ảnh và âm thanh như thế nào?",
    answer:
      "Các bộ phim trên RubyFilm hỗ trợ chất lượng hình ảnh sắc nét từ Full HD (1080p) đến 4K Ultra HD cùng âm thanh sống động. Hệ thống cung cấp đầy đủ bản Vietsub, Thuyết minh, Lồng tiếng và tích hợp nhiều máy chủ phát tốc độ cao (Server VIP, Server Dự phòng) giúp phát mượt mà, hạn chế tối đa gián đoạn.",
  },
  {
    id: "faq-5",
    number: "05",
    question: "Xem phim trên RubyFilm có mất phí hay bắt nạp VIP không?",
    answer:
      "Hoàn toàn MIỄN PHÍ 100%. Bạn có thể thưởng thức toàn bộ kho nội dung điện ảnh phong phú mà không cần nạp tiền hay mua bất kỳ gói VIP nào. RubyFilm cam kết mang đến trải nghiệm giải trí thoải mái, không chèn các quảng cáo popup độc hại hay gây phiền toái.",
  },
  {
    id: "faq-6",
    number: "06",
    question: "Nội dung phim được cập nhật với tần suất ra sao?",
    answer:
      "Hệ thống cập nhật phim mới liên tục 24/7 theo thời gian thực: các tập phim bộ mới nhất phát sóng cùng ngày với quốc tế, các bộ phim chiếu rạp bom tấn có bản đẹp sớm nhất kèm bản phụ đề Vietsub và thuyết minh chuẩn xác.",
  },
];

export function FaqSection() {
  const [openId, setOpenId] = React.useState<string | null>("faq-1");

  const toggleFaq = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="py-12 sm:py-16 select-none border-t border-[#262626]/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#F9FAFB] tracking-[-0.02em] mb-3">
              Câu Hỏi Thường Gặp
            </h2>
            <p className="text-sm sm:text-base text-[#D1D5DB] font-normal leading-[1.6] max-w-2xl">
              Bạn có thắc mắc? Dưới đây là những câu trả lời chi tiết và rõ ràng nhất về trải nghiệm xem phim tự do trên RubyFilm.
            </p>
          </div>

          <a
            href="https://t.me/Duy_Bao105"
            target="_blank"
            rel="noopener noreferrer"
            className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-[#F9FAFB] text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg shadow-[#E50000]/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Hỏi Thêm Thắc Mắc</span>
          </a>
        </div>

        {/* 2-Column FAQ Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;

            return (
              <div
                key={faq.id}
                className={`bg-[#0F0F0F] border transition-all duration-200 rounded-2xl p-5 sm:p-6 ${
                  isOpen ? "border-[#E50000]/60 bg-[#141414]" : "border-[#262626] hover:border-[#383838]"
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleFaq(faq.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleFaq(faq.id);
                    }
                  }}
                  className="flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-4">
                    {/* Number box */}
                    <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-[#262626] text-[#F9FAFB] font-extrabold flex items-center justify-center flex-shrink-0 text-sm">
                      {faq.number}
                    </div>

                    {/* Question title */}
                    <h3 className="text-base sm:text-lg font-extrabold text-[#F9FAFB] tracking-[-0.02em] pt-1.5 leading-snug">
                      {faq.question}
                    </h3>
                  </div>

                  {/* Toggle button */}
                  <button
                    type="button"
                    aria-label={isOpen ? "Thu gọn câu trả lời" : "Xem câu trả lời"}
                    className="w-9 h-9 rounded-xl bg-[#1A1A1A] border border-[#262626] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#262626] transition-colors"
                  >
                    {isOpen ? (
                      <Minus className="w-4 h-4 text-[#E50000]" />
                    ) : (
                      <Plus className="w-4 h-4 text-cinema-300" />
                    )}
                  </button>
                </div>

                {/* Dropdown Content */}
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-[#262626] text-xs sm:text-sm text-[#D1D5DB] font-normal leading-[1.6] pl-14 animate-fade-in">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
