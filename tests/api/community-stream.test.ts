import { describe, it, expect } from "vitest";

import { GET } from "@/app/api/community/stream/route";

function fakeRequest(movieId: string | null) {
  const url = movieId
    ? `http://test/api/community/stream?movieId=${encodeURIComponent(movieId)}`
    : `http://test/api/community/stream`;
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /api/community/stream (SSE, Review Focus #4 server side)", () => {
  it("returns 400 when movieId missing", async () => {
    const res = await GET(fakeRequest(null));
    expect(res.status).toBe(400);
  });

  it("returns text/event-stream with hello event on subscribe", async () => {
    const res = await GET(fakeRequest("mv_test_stream"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const chunk = decoder.decode(value);
    await reader.cancel();
    expect(chunk).toMatch(/event: hello/);
    expect(chunk).toMatch(/data: \{"movieId":"mv_test_stream"/);
  });
});