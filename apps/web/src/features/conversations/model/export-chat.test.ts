import { describe, expect, it } from "vitest";

import type { Chat } from "@/entities/chat";
import { chatToMarkdown } from "./export-chat";

describe("chatToMarkdown", () => {
  it("экспортирует расшифровку голосового сообщения как обычный текст", () => {
    const chat: Chat = {
      id: "1",
      title: "Голос",
      messages: [
        {
          id: "1",
          role: "user",
          text: "Напомни завтра позвонить маме",
          createdAt: Date.parse("2026-10-30T10:00:00+00:00"),
        },
        {
          id: "2",
          role: "assistant",
          text: "Готово, напоминание создано.",
          createdAt: Date.parse("2026-10-30T10:00:05+00:00"),
        },
      ],
    };

    const markdown = chatToMarkdown(chat);

    expect(markdown).toContain("Напомни завтра позвонить маме");
    expect(markdown).toContain("Готово, напоминание создано.");
    expect(markdown).not.toContain("Голосовое сообщение");
  });
});
