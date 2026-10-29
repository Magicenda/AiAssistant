import { Conversation } from "@/features/conversations";

/** Экран чата: без `sessionId` открывает новый диалог. */
export function ChatView({ sessionId }: { sessionId?: string }) {
  return <Conversation key={sessionId ?? "new"} sessionId={sessionId} />;
}
