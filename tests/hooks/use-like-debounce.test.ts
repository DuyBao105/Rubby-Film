// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLike } from "@/hooks/use-community";

describe("useLike debounce parity (Review Focus #1 client)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("double-tap within debounce window nets to no-op: no POST, state unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { liked: true, count: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLike("cmt_x", false, 0));

    act(() => { void result.current.toggle(); });
    act(() => { void result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.liked).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("single tap fires exactly one POST and applies server response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { liked: true, count: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLike("cmt_y", false, 0));

    act(() => { void result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.liked).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it("triple tap nets to single toggle: one POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { liked: true, count: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLike("cmt_z", false, 0));

    act(() => { void result.current.toggle(); });
    act(() => { void result.current.toggle(); });
    act(() => { void result.current.toggle(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.liked).toBe(true);
  });
});
