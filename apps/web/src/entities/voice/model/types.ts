export type JobStatus =
  | "pending"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "completed"
  | "failed";

export interface JobCreated {
  job_id: string;
  status: "pending";
}

export interface VoiceJob {
  job_id: string;
  status: JobStatus;
  error: string | null;
  transcript: string | null;
  agent_reply_text: string | null;
  audio_binary_url: string | null;
}

export interface Transcript {
  text: string;
}
