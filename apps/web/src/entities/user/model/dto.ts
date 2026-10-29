import type { AuthToken, AuthUser } from "./types";

export function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" &&
    typeof item.username === "string" &&
    typeof item.created_at === "string";
}

export function isAuthToken(value: unknown): value is AuthToken {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.access_token === "string" && item.token_type === "bearer";
}
