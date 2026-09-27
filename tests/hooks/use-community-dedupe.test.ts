import { describe, it, expect } from "vitest";
import { dedupeById, applyEventUpsert } from "@/hooks/use-community";

describe("dedupeById (Review Focus #4 client)", () => {
  it("adds new item when id absent", () => {
    expect(dedupeById<{ id: string; text: string }>([], { id: "a", text: "1" })).toEqual([
      { id: "a", text: "1" },
    ]);
  });
  it("preserves original insertion order", () => {
    const next = dedupeById<{ id: string; text: string }>(
      [{ id: "a", text: "1" }],
      { id: "b", text: "2" }
    );
    expect(next.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("drops duplicate by id (keeps original)", () => {
    const next = dedupeById<{ id: string; text: string }>(
      [{ id: "a", text: "1" }],
      { id: "a", text: "again" }
    );
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual({ id: "a", text: "1" });
  });
  it("handles repeated inserts without growing list", () => {
    let items: { id: string; text: string }[] = [];
    items = dedupeById(items, { id: "a", text: "1" });
    items = dedupeById(items, { id: "a", text: "1b" });
    items = dedupeById(items, { id: "b", text: "2" });
    items = dedupeById(items, { id: "a", text: "1c" });
    expect(items).toHaveLength(2);
    expect(items.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("applyEventUpsert (Review Focus #4 client)", () => {
  it("creates thread on comment_created with new top-level id", () => {
    const next = applyEventUpsert<{ id: string; parentId: string | null; text: string }>(
      [],
      "comment_created",
      { id: "c1", parentId: null, text: "hi" },
    );
    expect(next).toEqual([{ id: "c1", parentId: null, text: "hi" }]);
  });
  it("appends reply under matching parent instead of root", () => {
    const before = [
      { id: "c1", parentId: null, text: "top" },
      { id: "c2", parentId: "c1", text: "old reply" },
    ];
    const next = applyEventUpsert(
      before,
      "comment_created",
      { id: "c3", parentId: "c1", text: "new reply" },
    );
    // Fold semantics: flat siblings of the parent collapse into parent.replies.
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("c1");
    expect((next[0] as any).replies?.map((r: any) => r.id)).toEqual(["c2", "c3"]);
  });
  it("ignores duplicate comment_created for same id", () => {
    const before = [{ id: "c1", parentId: null, text: "hi" }];
    const next = applyEventUpsert(
      before,
      "comment_created",
      { id: "c1", parentId: null, text: "again" },
    );
    expect(next).toBe(before); // ref-stable on no-op
  });
});
