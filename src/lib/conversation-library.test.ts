import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Conversation } from "@/types";
import { filterConversations, groupConversations } from "./conversation-library";

const row = (id: string, title: string, updatedAt: string): Conversation => ({
  id,
  title,
  updatedAt,
  createdAt: updatedAt,
  model: "doubao",
  messageCount: 1,
});

describe("conversation library", () => {
  it("filters case-insensitively", () => {
    assert.deepEqual(
      filterConversations([row("1", "Design Notes", "2026-08-20")], "design").map((item) => item.id),
      ["1"],
    );
  });

  it("groups by recency", () => {
    const groups = groupConversations(
      [
        row("1", "a", "2026-08-20T02:00:00.000Z"),
        row("2", "b", "2026-08-17T02:00:00.000Z"),
        row("3", "c", "2026-07-01T02:00:00.000Z"),
      ],
      new Date("2026-08-20T12:00:00+08:00"),
    );
    assert.deepEqual(groups.map((group) => group.label), ["今天", "最近 7 天", "更早"]);
  });
});
