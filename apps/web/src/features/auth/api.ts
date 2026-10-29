import { ApiError, apiRequest, getAccessToken, parseData } from "@/shared/api";
import { isAuthToken, isAuthUser, type AuthToken, type AuthUser } from "@/entities/user";

export async function register(username: string, password: string): Promise<AuthUser> {
  return parseData(
    await apiRequest("/api/auth/register", {
      method: "POST",
      body: { username, password },
    }),
    isAuthUser,
  );
}

export async function login(username: string, password: string): Promise<AuthToken> {
  return parseData(
    await apiRequest("/api/auth/login", {
      method: "POST",
      body: new URLSearchParams({ username, password }),
    }),
    isAuthToken,
  );
}

export async function me(): Promise<AuthUser | null> {
  if (!getAccessToken()) return null;
  try {
    return parseData(await apiRequest("/api/auth/me"), isAuthUser);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return null;
    throw cause;
  }
}
