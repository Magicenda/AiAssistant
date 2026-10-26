export type ChatRole = "user" | "assistant";

export interface ChatAudio {
  dataUrl: string;
  type: string;
  duration: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  role: ChatRole;
  audio?: ChatAudio;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
}
