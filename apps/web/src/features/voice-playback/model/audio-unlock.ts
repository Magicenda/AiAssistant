/**
 * Разблокировка автозапуска звука.
 *
 * После async (STT/LLM) `audio.play()` и `speechSynthesis.speak` часто
 * падают с NotAllowedError: жест пользователя уже «съеден». Вызов
 * `unlockAudioPlayback()` на нажатии микрофона открывает «ворота» на сессию.
 *
 * На Safari `play()` / `resume()` иногда зависают — поэтому всё с таймаутом,
 * чтобы не блокировать старт MediaRecorder.
 */

let unlocked = false;
let sharedAudio: HTMLAudioElement | null = null;

/** Тишина в WAV: достаточно, чтобы браузер засчитал gesture → playback. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return new Promise(resolve => {
    const timer = globalThis.setTimeout(() => resolve(undefined), ms);
    promise.then(
      value => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      () => {
        globalThis.clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

/**
 * Разрешает последующее воспроизведение без жеста.
 * Безопасно вызывать повторно; ошибки и зависания не блокируют запись.
 */
export async function unlockAudioPlayback(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const context = new Ctx();
      if (context.state === "suspended") await withTimeout(context.resume(), 500);
      try {
        const buffer = context.createBuffer(1, 1, 22050);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
      } catch {
        // ignore
      }
      await withTimeout(
        context.close().catch(() => undefined),
        300,
      );
    }
  } catch {
    // Web Audio недоступен — всё равно пробуем HTMLAudio / speechSynthesis.
  }

  try {
    if (!sharedAudio) sharedAudio = new Audio();
    sharedAudio.src = SILENT_WAV;
    sharedAudio.volume = 0.001;
    await withTimeout(sharedAudio.play(), 500);
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
  } catch {
    // iOS иногда требует реальный жест; повтор при следующем тапе.
  }

  try {
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(" ");
      utterance.volume = 0;
      speechSynthesis.speak(utterance);
      speechSynthesis.cancel();
    }
  } catch {
    // Нет синтеза — серверный TTS всё равно пойдёт через <audio>.
  }

  unlocked = true;
}

/** Был ли уже успешный unlock в этой вкладке. */
export function isAudioUnlocked() {
  return unlocked;
}

/**
 * Общий `<audio>` после unlock: Safari/Chrome лучше пускают play на том же элементе,
 * который уже играл в рамках жеста.
 */
export function getSharedAudioElement(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}
