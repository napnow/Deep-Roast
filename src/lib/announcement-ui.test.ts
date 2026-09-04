import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAnnouncementCount,
  getUnreadAnnouncementCount,
} from "@/lib/announcement-ui";

test("counts only announcements missing from the seen id set", () => {
  assert.equal(
    getUnreadAnnouncementCount(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      new Set(["b"]),
    ),
    2,
  );
});

test("formats a large unread count as 9+", () => {
  assert.equal(formatAnnouncementCount(0), "0");
  assert.equal(formatAnnouncementCount(9), "9");
  assert.equal(formatAnnouncementCount(10), "9+");
});

test("returns zero for an empty list or when every announcement is seen", () => {
  assert.equal(getUnreadAnnouncementCount([], new Set()), 0);
  assert.equal(
    getUnreadAnnouncementCount(
      [{ id: "a" }, { id: "b" }],
      new Set(["a", "b"]),
    ),
    0,
  );
});
