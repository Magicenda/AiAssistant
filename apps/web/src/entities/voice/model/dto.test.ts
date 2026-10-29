import { describe, expect, it } from "vitest";
import { isJobCreated, isTranscript, isVoiceJob } from "./dto";

describe("voice DTO guards", () => {
  it("validates a completed job", () => {
    expect(isVoiceJob({
      job_id: "1d8f8bd6",
      status: "completed",
      error: null,
      transcript: "запиши задачу",
      agent_reply_text: "Записал",
      audio_binary_url: "/api/voice/jobs/1d8f8bd6/audio",
    })).toBe(true);
  });

  it("accepts a pending job with null fields", () => {
    expect(isVoiceJob({
      job_id: "x",
      status: "pending",
      error: null,
      transcript: null,
      agent_reply_text: null,
      audio_binary_url: null,
    })).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isVoiceJob({
      job_id: "x",
      status: "done",
      error: null,
      transcript: null,
      agent_reply_text: null,
      audio_binary_url: null,
    })).toBe(false);
  });

  it("validates created jobs and transcripts", () => {
    expect(isJobCreated({ job_id: "x", status: "pending" })).toBe(true);
    expect(isJobCreated({ job_id: "x", status: "completed" })).toBe(false);
    expect(isTranscript({ text: "hi" })).toBe(true);
    expect(isTranscript({ text: 1 })).toBe(false);
  });
});
