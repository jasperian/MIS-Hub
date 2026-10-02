import { HttpError, string } from "./auth";
import { TaskPriority } from "@prisma/client";

export function optionalText(value: unknown, field: string, max = 10000) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" || value.length > max)
    throw new HttpError(400, `${field} must be text (maximum ${max} characters).`);
  return value.trim();
}

export function taskInput(input: Record<string, unknown>) {
  const priority = input.priority ?? TaskPriority.MEDIUM;
  if (priority !== "LOW" && priority !== "MEDIUM" && priority !== "HIGH")
    throw new HttpError(400, "Choose Low, Medium, or High priority.");
  return {
    title: string(input.title, "Title"),
    details: optionalText(input.details, "Details"),
    priority: priority as TaskPriority,
  };
}

export function noteInput(input: Record<string, unknown>) {
  return {
    title: string(input.title, "Title"),
    content: optionalText(input.content, "Content"),
  };
}

export function taskChanges(input: Record<string, unknown>) {
  const changes: Record<string, unknown> = {};
  if (input.title !== undefined) changes.title = string(input.title, "Title");
  if (input.details !== undefined) changes.details = optionalText(input.details, "Details");
  if (input.priority !== undefined) {
    if (!["LOW", "MEDIUM", "HIGH"].includes(String(input.priority)))
      throw new HttpError(400, "Choose Low, Medium, or High priority.");
    changes.priority = input.priority;
  }
  if (input.completed !== undefined) {
    if (typeof input.completed !== "boolean") throw new HttpError(400, "Completed must be true or false.");
    changes.completed = input.completed;
  }
  if (!Object.keys(changes).length) throw new HttpError(400, "No changes provided.");
  return changes;
}
