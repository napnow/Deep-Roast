import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOBILE_PRIMARY_WORKSPACES,
  getMobileCheckinCard,
  getMobilePrimaryWorkspace,
  getMobileWorkspaceTitle,
} from "./mobile-workspace-ui";

describe("mobile workspace UI", () => {
  it("maps image tabs and chat to the three persistent mobile destinations", () => {
    assert.equal(getMobilePrimaryWorkspace("image", "generate"), "generate");
    assert.equal(getMobilePrimaryWorkspace("image", "gallery"), "gallery");
    assert.equal(getMobilePrimaryWorkspace("chat", "generate"), "chat");
    assert.equal(
      getMobilePrimaryWorkspace("image", "announcements"),
      "generate",
    );
  });

  it("uses only existing business areas in the mobile bottom navigation", () => {
    assert.deepEqual(
      MOBILE_PRIMARY_WORKSPACES.map((item) => item.label),
      ["生图", "对话", "作品", "我的"],
    );
  });

  it("keeps the compact header title aligned with the visible workspace", () => {
    assert.equal(getMobileWorkspaceTitle("image", "generate"), "生图");
    assert.equal(getMobileWorkspaceTitle("image", "gallery"), "图库");
    assert.equal(getMobileWorkspaceTitle("image", "announcements"), "公告");
    assert.equal(getMobileWorkspaceTitle("chat", "generate"), "对话");
  });

  it("makes check-in actionable only once per day", () => {
    assert.deepEqual(
      getMobileCheckinCard({
        eligible: true,
        todayChecked: false,
        loading: false,
        reward: 50,
      }),
      { label: "今日签到", detail: "+50 积分", disabled: false },
    );
    assert.deepEqual(
      getMobileCheckinCard({
        eligible: true,
        todayChecked: true,
        loading: false,
        reward: 50,
      }),
      { label: "今日已签到", detail: "明日再来", disabled: true },
    );
  });

  it("keeps unavailable and loading check-in cards disabled", () => {
    assert.equal(
      getMobileCheckinCard({
        eligible: false,
        todayChecked: false,
        loading: false,
        reward: 50,
      }).disabled,
      true,
    );
    assert.deepEqual(
      getMobileCheckinCard({
        eligible: true,
        todayChecked: false,
        loading: true,
        reward: 50,
      }),
      { label: "签到中…", detail: "+50 积分", disabled: true },
    );
  });
});
