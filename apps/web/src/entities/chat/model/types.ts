export interface ChatMessage {
  id: string;
  text: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
}
