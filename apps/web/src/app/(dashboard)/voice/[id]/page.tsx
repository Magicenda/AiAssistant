import { VoiceView } from "@/views/voice";

export const metadata = { title: "Голос" };

export default async function VoiceChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <VoiceView chatId={id} />;
}
