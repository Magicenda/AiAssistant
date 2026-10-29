import type { JobCreated, JobStatus, Transcript, VoiceJob } from "./types";

const STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "transcribing",
  "thinking",
  "speaking",
  "completed",
  "failed",
]);

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && STATUSES.has(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isJobCreated(value: unknown): value is JobCreated {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.job_id === "string" && item.status === "pending";
}

export function isVoiceJob(value: unknown): value is VoiceJob {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.job_id === "string" &&
    isJobStatus(item.status) &&
    isNullableString(item.error) &&
    isNullableString(item.transcript) &&
    isNullableString(item.agent_reply_text) &&
    isNullableString(item.audio_binary_url);
}

export function isTranscript(value: unknown): value is Transcript {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Record<string, unknown>).text === "string";
}
