import { getApiUrl } from "@/shared/lib/api-url";

export const apiConfig = {
  baseUrl: getApiUrl(),
  timeoutsMs: {
    default: 15_000,
    llmQuery: 120_000,
    transcribe: 30_000,
    audioUpload: 60_000,
    jobStatus: 10_000,
  },
  limits: {
    audioMaxBytes: 25 * 1024 * 1024,
    jobPollIntervalMs: 700,
    jobPollTimeoutMs: 3 * 60 * 1000,
    jobTtlMs: 15 * 60 * 1000,
  },
} as const;
