type ChatRole = "user" | "assistant";

export interface ChatReply {
  /** id исходного сообщения. */
  id: string;
  role: ChatRole;
  /** Превью текста на момент ответа. */
  text: string;
}

export interface ChatMessage {
  id: string;
  /** Текст сообщения; у голосового — расшифровка речи. */
  text: string;
  role: ChatRole;
  /** Unix-время создания в миллисекундах. */
  createdAt?: number;
  /** Цитата, на которую отвечают. */
  replyTo?: ChatReply;
}

export interface Chat {
  id: string;
  /** Название из первого сообщения; пустое показывается как «Новый чат». */
  title: string;
  messages: ChatMessage[];
  /** Закреплён сверху списка. */
  pinned?: boolean;
  /** Unix-время последней активности в миллисекундах. */
  updatedAt?: number;
}

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatReplyDto {
  /** id исходного сообщения; у старых записей может отсутствовать. */
  id?: string | null;
  role: ChatMessageRole;
  /** Превью текста на момент ответа. */
  text: string;
}

export interface ChatMessageDto {
  id: number;
  role: ChatMessageRole;
  content: string;
  created_at: string;
  reply_to?: ChatReplyDto | null;
}

export interface ChatDto {
  chat_id: number;
  name_chat: string;
  messages: ChatMessageDto[];
  pinned?: boolean;
}
