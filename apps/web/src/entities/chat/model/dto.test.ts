import { describe, expect, it } from "vitest";
import { chatDtoToDomain, isChatDto, isChatList, isChatMessageDto, isLlmAnswer } from "./dto";

const message = {
  id: 10,
  role: "user",
  content: "Привет",
  created_at: "2026-10-29T16:05:29+00:00",
};
const chat = { chat_id: 3, name_chat: "Рабочие дела", messages: [message] };

describe("chat DTO guards", () => {
  it("accepts valid messages and chats", () => {
    expect(isChatMessageDto(message)).toBe(true);
    expect(isChatDto(chat)).toBe(true);
    expect(isChatList([chat])).toBe(true);
  });

  it("accepts every server role", () => {
    for (const role of ["user", "assistant", "system", "tool"]) {
      expect(isChatMessageDto({ ...message, role })).toBe(true);
    }
  });

  it("rejects unknown roles, bad dates and wrong id types", () => {
    expect(isChatMessageDto({ ...message, role: "bot" })).toBe(false);
    expect(isChatMessageDto({ ...message, created_at: "nope" })).toBe(false);
    expect(isChatDto({ ...chat, chat_id: "3" })).toBe(false);
  });

  it("rejects lists with invalid items", () => {
    expect(isChatList([chat, { ...chat, messages: [{}] }])).toBe(false);
    expect(isChatList("hidden")).toBe(false);
  });

  it("validates llm answers", () => {
    expect(isLlmAnswer({ answer: "ok" })).toBe(true);
    expect(isLlmAnswer({})).toBe(false);
  });
});

describe("chatDtoToDomain", () => {
  it("maps server fields to the client model", () => {
    const domain = chatDtoToDomain({
      chat_id: 3,
      name_chat: "Рабочие дела",
      messages: [
        { id: 10, role: "user", content: "Привет", created_at: "2026-10-29T16:05:29+00:00" },
        { id: 11, role: "tool", content: "tool out", created_at: "2026-10-29T16:05:30+00:00" },
      ],
    });
    expect(domain).toEqual({
      id: "3",
      title: "Рабочие дела",
      pinned: false,
      updatedAt: Date.parse("2026-10-29T16:05:30+00:00"),
      messages: [
        {
          id: "10",
          text: "Привет",
          role: "user",
          createdAt: Date.parse("2026-10-29T16:05:29+00:00"),
        },
        {
          id: "11",
          text: "tool out",
          role: "assistant",
          createdAt: Date.parse("2026-10-29T16:05:30+00:00"),
        },
      ],
    });
  });

  it("maps pinning and reply quotes", () => {
    const domain = chatDtoToDomain({
      chat_id: 4,
      name_chat: "Закреплённый",
      pinned: true,
      messages: [
        {
          id: 12,
          role: "user",
          content: "Продолжи",
          created_at: "2026-10-29T16:05:29+00:00",
          reply_to: { id: "10", role: "assistant", text: "Прошлый ответ" },
        },
      ],
    });

    expect(domain.pinned).toBe(true);
    expect(domain.messages[0].replyTo).toEqual({
      id: "10",
      role: "assistant",
      text: "Прошлый ответ",
    });
  });
});
