"use client";

import { SendHorizonal } from "lucide-react";

import { Button } from "@/shared/ui/button";

export function ChatInput() {
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm outline-none"
        placeholder="Напишите сообщение…"
      />
      <Button type="submit" size="icon">
        <SendHorizonal className="size-4" />
      </Button>
    </form>
  );
}
