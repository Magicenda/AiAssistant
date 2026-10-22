export async function sendAudio(file: File, signal: AbortSignal) {
  const endpoint = process.env.NEXT_PUBLIC_AUDIO_UPLOAD_URL;
  if (!endpoint) throw new Error("Отправка аудио пока не настроена. Запись можно скачать.");

  const raw = process.env.NEXT_PUBLIC_AUDIO_UPLOAD_MODE === "binary";
  const form = new FormData();
  form.append(process.env.NEXT_PUBLIC_AUDIO_UPLOAD_FIELD || "file", file);
  const response = await fetch(endpoint, {
    method: "POST",
    body: raw ? file : form,
    headers: raw ? { "Content-Type": file.type } : undefined,
    signal,
  });
  if (!response.ok) throw new Error(`Не удалось отправить запись (HTTP ${response.status}).`);
}
