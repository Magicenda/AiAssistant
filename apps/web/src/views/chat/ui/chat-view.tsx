import { Bot, SendHorizonal, User } from "lucide-react";

import { ChatInput } from "@/features/chat-input";
import type { Message } from "@/entities/message";

const MOCK_MESSAGES: Message[] = [
  { id: "1", role: "user", text: "Привет! Чем можешь помочь?", createdAt: "", chatId: "" },
  { id: "2", role: "assistant", text: "Привет! Я AI-помощник. Заглушка чата.", createdAt: "", chatId: "" },
];

export function ChatView({ sessionId }: { sessionId?: string }) {
  return (
    <section className="flex h-dvh flex-col">
      <header className="border-b p-4 text-sm text-muted-foreground">
        Диалог {sessionId ?? "новый"}
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {MOCK_MESSAGES.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "self-end rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
                : "bg-muted self-start rounded-2xl px-4 py-2"
            }
          >
            {message.role === "user" ? (
              <User className="mr-2 inline size-4" />
            ) : (
              <Bot className="mr-2 inline size-4" />
            )}
            {message.text}
          </div>
        ))}
      </div>

      <footer className="border-t p-4">
        <ChatInput />
      </footer>
    </section>
  );
}
