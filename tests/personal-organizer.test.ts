import test from "node:test";
import assert from "node:assert/strict";
import { noteInput, taskChanges, taskInput } from "../lib/server/personal-organizer";

test("task and note inputs validate priority, completion and titles", () => {
  assert.deepEqual(taskInput({ title: " Review backups ", priority: "HIGH" }), { title: "Review backups", details: "", priority: "HIGH" });
  assert.deepEqual(taskChanges({ completed: true }), { completed: true });
  assert.throws(() => taskInput({ title: "Review", priority: "URGENT" }));
  assert.throws(() => taskChanges({ completed: "yes" }));
  assert.throws(() => taskChanges({}));
  assert.throws(() => noteInput({ title: " ", content: "Text" }));
  assert.throws(() => noteInput({ title: "Note", content: 123 }));
});
