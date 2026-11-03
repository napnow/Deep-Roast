import { strict as assert } from "node:assert";
import { test } from "node:test";
import { filterAdminUsers } from "./admin-directory";

test("user directory filters names without case or surrounding-space sensitivity", () => {
  const users = [{ username: "Anna", status: "active" }, { username: "Bob", status: "banned" }];
  assert.deepEqual(filterAdminUsers(users, " AN ", "all"), [users[0]]);
  assert.deepEqual(filterAdminUsers(users, "", "banned"), [users[1]]);
  assert.deepEqual(filterAdminUsers(users, "unknown", "all"), []);
});
