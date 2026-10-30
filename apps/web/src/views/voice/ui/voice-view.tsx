import { VoiceMode } from "@/features/voice-mode";

interface VoiceViewProps {
  /** Чат для продолжения; без него голосовой диалог начнётся с нуля. */
  chatId?: string;
}

/** Экран голосового режима: пиксельный ассистент, микрофон и история реплик. */
export function VoiceView({ chatId }: VoiceViewProps) {
  return <VoiceMode key={chatId ?? "new"} chatId={chatId} />;
}
