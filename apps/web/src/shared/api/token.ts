const STORAGE_KEY = "assistant-auth-token-v1";

let memoryToken: string | null = null;

export function getAccessToken(): string | null {
  if (memoryToken !== null) return memoryToken;
  try {
    memoryToken = localStorage.getItem(STORAGE_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function setAccessToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    return;
  }
}

export function clearAccessToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  clearAccessToken();
  unauthorizedHandler?.();
}
