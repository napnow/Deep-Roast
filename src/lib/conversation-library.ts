import type { Conversation } from "@/types";

export interface ConversationGroup {
  label: "今天" | "最近 7 天" | "更早";
  conversations: Conversation[];
}

export function filterConversations(rows: Conversation[], query: string) {
  const needle = query.trim().toLowerCase();
  return needle
    ? rows.filter((row) => row.title.toLowerCase().includes(needle))
    : rows;
}

export function groupConversations(
  rows: Conversation[],
  now = new Date(),
): ConversationGroup[] {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets: Record<ConversationGroup["label"], Conversation[]> = {
    今天: [],
    "最近 7 天": [],
    更早: [],
  };
  for (const row of rows) {
    const time = new Date(row.updatedAt).getTime();
    const age = startToday - time;
    const label = age < 86400000 ? "今天" : age < 7 * 86400000 ? "最近 7 天" : "更早";
    buckets[label].push(row);
  }
  return (["今天", "最近 7 天", "更早"] as const)
    .filter((label) => buckets[label].length)
    .map((label) => ({ label, conversations: buckets[label] }));
}
