import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RubyFilm - Xem Phim Trực Tuyến Chuẩn 4K",
    short_name: "RubyFilm",
    description:
      "RubyFilm mang đến trải nghiệm xem phim điện ảnh đỉnh cao, chất lượng 4K Ultra HD, tốc độ mượt mà.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F0F0F",
    theme_color: "#0D0F12",
    categories: ["entertainment", "movies", "video"],
    lang: "vi",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Phim Thịnh Hành",
        short_name: "Thịnh Hành",
        description: "Khám phá các bộ phim thịnh hành nhất",
        url: "/trending",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Phim Bộ",
        short_name: "Phim Bộ",
        description: "Xem danh sách phim bộ hot nhất",
        url: "/series",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Phim Lẻ",
        short_name: "Phim Lẻ",
        description: "Xem tuyển tập phim lẻ chất lượng cao",
        url: "/movies?type=single",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
