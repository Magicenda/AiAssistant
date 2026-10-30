import { describe, expect, it } from "vitest";

import type { ChatMessageDto } from "@/entities/chat";
import { turnsFromHistory, voiceChatTitle } from "./turns";

function message(id: number, role: ChatMessageDto["role"], content: string): ChatMessageDto {
  return { id, role, content, created_at: "2026-10-30T10:00:00Z" };
}

describe("voiceChatTitle", () => {
  it("берёт первую строку и убирает markdown", () => {
    expect(voiceChatTitle("**Купить хлеб**\nи молоко")).toBe("Купить хлеб");
  });

  it("обрезает длинную фразу", () => {
    const title = voiceChatTitle("а".repeat(80));
    expect(title).toHaveLength(49);
    expect(title.endsWith("…")).toBe(true);
  });

  it("подставляет название, если текста не осталось", () => {
    expect(voiceChatTitle("```код```")).toBe("Голосовой чат");
  });
});

describe("turnsFromHistory", () => {
  it("оставляет только реплики пользователя и ассистента", () => {
    const turns = turnsFromHistory([
      message(1, "system", "system prompt"),
      message(2, "user", "привет"),
      message(3, "tool", "tool output"),
      message(4, "assistant", "здравствуйте"),
      message(5, "assistant", "   "),
    ]);

    expect(turns).toEqual([
      { id: "history-2", role: "user", text: "привет" },
      { id: "history-4", role: "assistant", text: "здравствуйте" },
    ]);
  });
});
