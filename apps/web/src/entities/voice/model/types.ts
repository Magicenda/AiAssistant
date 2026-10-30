export type JobStatus =
  "pending" | "transcribing" | "thinking" | "speaking" | "completed" | "failed";

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

/** Ссылка на потоковую озвучку: `<audio src>` играет её по мере синтеза. */
export interface SpeechStream {
  /** Относительный путь на backend; фронтенд добавляет базовый адрес. */
  stream_url: string;
  /** Сколько секунд ссылка остаётся действительной. */
  expires_in: number;
}

/** Движок озвучки: системный голос браузера или серверный Edge TTS. */
export type VoiceEngine = "browser" | "server";

/** Настройки озвучки, хранящиеся в localStorage браузера. */
export interface VoiceSettings {
  /** Чем озвучивать: браузером (мгновенно) или сервером (красивее, но с задержкой). */
  engine: VoiceEngine;
}
