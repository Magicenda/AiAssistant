import { Conversation } from "@/features/conversations";

export function ChatView({ sessionId }: { sessionId?: string }) {
  return <Conversation key={sessionId ?? "new"} sessionId={sessionId} />;
}
