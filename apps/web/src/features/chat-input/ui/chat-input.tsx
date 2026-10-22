"use client";

import { SendHorizonal } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function ChatInput() {
  return (
    <form className="flex items-center gap-2" onSubmit={(event) => event.preventDefault()}>
      <Input disabled aria-label="Сообщение ассистенту"
        className="h-12 border-0 bg-transparent shadow-none"
        placeholder="Скоро здесь можно будет рассказать о своих планах…" />
      <Button disabled aria-label="Отправить сообщение" type="submit" size="icon">
        <SendHorizonal className="size-4" />
      </Button>
    </form>
  );
}
