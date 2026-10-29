interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function logRequest(entry: RequestLogEntry): void {
  if (isProduction()) return;
  console.info(`[api] ${entry.method} ${entry.path} → ${entry.status} (${entry.durationMs}ms)`);
}

export function logError(context: string, cause: unknown): void {
  if (isProduction()) return;
  console.error(`[api] ${context}`, cause instanceof Error ? cause.message : String(cause));
}
