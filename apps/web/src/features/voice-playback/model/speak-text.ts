import { createSpeechStream } from "@/features/assistant";
import { readVoiceSettings } from "@/entities/voice";
import { plainText } from "@/shared/lib/plain-text";

/** Фаза подготовки и проигрывания речи. */
export type SpeakPhase = "loading" | "playing";

export interface SpeakOptions {
  /** Отмена: останавливает запрос озвучки и текущий звук. */
  signal?: AbortSignal;
  /** Колбэк для кнопки и статуса: сначала загрузка, потом проигрывание. */
  onPhase?: (phase: SpeakPhase) => void;
}

interface CachedStream {
  url: string;
  expiresAt: number;
}

// Ссылки на потоковую озвучку можно переиспользовать, пока они не истекли.
const cache = new Map<string, CachedStream>();
const maxCached = 30;

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

function remember(text: string, value: CachedStream) {
  cache.set(text, value);
  if (cache.size <= maxCached) return;
  const oldest = cache.keys().next().value;
  if (oldest !== undefined) cache.delete(oldest);
}

/** Возвращает ссылку на потоковую озвучку: из кэша или новую с backend. */
async function urlFor(text: string, signal: AbortSignal) {
  const cached = cache.get(text);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { url, expiresIn } = await createSpeechStream(text, signal);
  if (signal.aborted) throw abortError();

  // Ссылка живёт 5 минут на backend; берём запас, чтобы не попасть на истечение.
  remember(text, { url, expiresAt: Date.now() + Math.max(10, expiresIn - 20) * 1000 });
  return url;
}

/** Играет поток и резолвится по окончании; отмена прерывает звук. */
function play(url: string, signal: AbortSignal, onPlaying: () => void) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const audio = new Audio(url);
    const cleanup = () => {
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };
    const stop = () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
    const onAbort = () => {
      stop();
      cleanup();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    audio.onplaying = () => onPlaying();
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Не удалось воспроизвести озвучку."));
    };
    void audio.play().catch(cause => {
      cleanup();
      reject(cause);
    });
  });
}

/**
 * Озвучивает текст системным голосом браузера: без сети и задержки на TTS.
 * Если русского голоса нет, браузер подберёт голос по `lang`.
 */
function browserSpeak(text: string, signal: AbortSignal, onPlaying: () => void) {
  return new Promise<void>((resolve, reject) => {
    if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
      reject(new Error("Браузер не поддерживает синтез речи."));
      return;
    }
    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    utterance.rate = 1;
    const russian = speechSynthesis
      .getVoices()
      .find(voice => voice.lang.toLowerCase().startsWith("ru"));
    if (russian) utterance.voice = russian;

    let started = false;
    const cleanup = () => {
      globalThis.clearTimeout(startTimer);
      signal.removeEventListener("abort", onAbort);
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    };
    const onAbort = () => {
      speechSynthesis.cancel();
      cleanup();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });

    utterance.onstart = () => {
      started = true;
      onPlaying();
    };
    utterance.onend = () => {
      cleanup();
      resolve();
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      cleanup();
      reject(
        new Error(
          event.error === "not-allowed"
            ? "Браузер запретил озвучку. Нажмите «Повторить»."
            : "Не удалось озвучить ответ.",
        ),
      );
    };

    // Если браузер проигнорировал запрос, не оставляем кнопку в вечной загрузке.
    const startTimer = globalThis.setTimeout(() => {
      if (started) return;
      speechSynthesis.cancel();
      cleanup();
      reject(new Error("Браузер не начал озвучку. Нажмите «Повторить»."));
    }, 4000);

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

/**
 * Озвучивает текст выбранным движком: браузерным (мгновенно) или серверным
 * потоком (красивее, но первый звук ждёт Edge TTS).
 *
 * @param text - текст ответа ассистента.
 * @param options - отмена и колбэк фазы.
 */
export async function speakText(text: string, options: SpeakOptions = {}) {
  const clean = plainText(text);
  if (!clean) return;

  const signal = options.signal ?? new AbortController().signal;
  if (signal.aborted) throw abortError();

  options.onPhase?.("loading");
  if (readVoiceSettings().engine === "browser") {
    await browserSpeak(clean, signal, () => options.onPhase?.("playing"));
    return;
  }

  const url = await urlFor(clean, signal);
  if (signal.aborted) throw abortError();

  await play(url, signal, () => options.onPhase?.("playing"));
}
