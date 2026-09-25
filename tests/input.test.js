import { test } from "node:test";
import assert from "node:assert/strict";
import { isFingerPointer } from "../js/input.js";

test("só toque e caneta são finger-follow", () => {
  assert.equal(isFingerPointer("touch"), true);
  assert.equal(isFingerPointer("pen"), true);
  assert.equal(isFingerPointer("mouse"), false);
  assert.equal(isFingerPointer(""), false);
  assert.equal(isFingerPointer(undefined), false);
});
