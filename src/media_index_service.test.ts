import test from "node:test";
import assert from "node:assert/strict";
import { decideIndex } from "./media_index_service.ts";

test("indexes an asset from dimensions and format instead of its filename", () => {
  assert.equal(decideIndex({ width: 1600, height: 900, format: "png" }), "indexed");
  assert.equal(decideIndex({ width: 1600, height: 900 }), "review");
});
