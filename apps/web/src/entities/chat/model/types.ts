export type ChatRole = "user" | "assistant";

export interface ChatAudio {
  dataUrl: string;
  type: string;
  duration: number;
}

export interface ChatReply {
  id: string;
  role: ChatRole;
  text: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  role: ChatRole;
  createdAt?: number;
  replyTo?: ChatReply;
  audio?: ChatAudio;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned?: boolean;
  updatedAt?: number;
  /** id чата на backend; создаётся при первом запросе к серверу. */
  remoteId?: number;
}
