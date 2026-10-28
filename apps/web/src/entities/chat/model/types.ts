export type ChatRole = "user" | "assistant";

export interface ChatAudio {
  /** Запись в виде data URL. */
  dataUrl: string;
  /** MIME-тип, например `audio/webm;codecs=opus`. */
  type: string;
  /** Длительность в секундах. */
  duration: number;
}

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
  /** Голосовое вложение. */
  audio?: ChatAudio;
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
  /** id чата на backend; создаётся при первом запросе к серверу. */
  remoteId?: number;
}
