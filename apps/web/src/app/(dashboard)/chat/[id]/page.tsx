import { ChatView } from "@/views/chat";

export const metadata = { title: "Чат" };

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ChatView sessionId={id} />;
}
