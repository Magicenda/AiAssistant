export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  chatId: string;
}
