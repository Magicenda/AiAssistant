"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { unlockAudioPlayback } from "@/features/voice-playback";

export type RecorderStatus = "idle" | "starting" | "recording" | "stopping";

interface VoiceRecorderOptions {
  /** Вызывается готовой записью: по тишине, по кнопке или по лимиту времени. */
  onComplete: (clip: Blob) => void;
  /** Сколько тишины после речи ждать перед автоматической отправкой. */
  silenceMs?: number;
  /** Сколько ждать первую фразу, прежде чем закрыть микрофон. */
  noSpeechMs?: number;
  /** Максимальная длительность записи. */
  maxMs?: number;
}

interface VoiceRecorder {
  status: RecorderStatus;
  /** Громкость 0–1 для анимации ассистента. */
  level: number;
  /** Длительность записи в секундах. */
  elapsed: number;
  /** Текст ошибки микрофона или распознавания. */
  error: string;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

// Ниже порог: на Safari/ноутбуках RMS часто тише, чем в Chrome на телефоне.
const speechThreshold = 0.012;

function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
}

/** Считает среднеквадратичную громкость текущего кадра микрофона. */
function readLevel(analyser: AnalyserNode) {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (const value of data) {
    const sample = (value - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / data.length);
}

/** Подбирает mime, который MediaRecorder реально умеет на этом браузере. */
function pickMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  // Safari стабильнее на mp4 без timeslice; Chrome — на webm/opus.
  const candidates = isSafari()
    ? ["audio/mp4", "audio/aac", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

/**
 * Записывает голос для голосового режима ('use client': `MediaRecorder` и Web Audio).
 * Останавливается сама после паузы в речи и не отправляет тишину.
 *
 * @param options - Колбэк готовой записи и тайминги автоостановки.
 * @returns Статус, громкость, длительность и управление записью.
 */
export function useVoiceRecorder({
  onComplete,
  silenceMs = 1800,
  noSpeechMs = 12000,
  maxMs = 60_000,
}: VoiceRecorderOptions): VoiceRecorder {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const monitor = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const lastVoiceAt = useRef(0);
  const hasSpoken = useRef(false);
  const cancelled = useRef(false);
  const noSpeech = useRef(false);
  /** Ручная отправка («Отправить»): не отбрасывать клип, даже если VAD не увидел речь. */
  const forceSend = useRef(false);
  const starting = useRef(false);
  const statusRef = useRef<RecorderStatus>("idle");
  // Счётчик «поколений»: колбэки устаревшего запуска не должны менять состояние.
  const generation = useRef(0);

  const updateStatus = useCallback((next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopMonitor = useCallback(() => {
    if (monitor.current !== null) {
      clearInterval(monitor.current);
      monitor.current = null;
    }
  }, []);

  const release = useCallback(() => {
    stopMonitor();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    analyser.current = null;
    const context = audioContext.current;
    audioContext.current = null;
    if (context) void context.close().catch(() => undefined);
  }, [stopMonitor]);

  const beginMonitor = useCallback(
    (current: number, silence: number, noSpeechLimit: number, maxDuration: number) => {
      stopMonitor();
      startedAt.current = Date.now();
      lastVoiceAt.current = startedAt.current;
      setElapsed(0);
      updateStatus("recording");

      monitor.current = setInterval(() => {
        if (current !== generation.current) return;
        const now = Date.now();
        const duration = now - startedAt.current;
        const currentLevel = analyser.current ? readLevel(analyser.current) : 0;
        setLevel(currentLevel);
        setElapsed(Math.round(duration / 100) / 10);

        if (currentLevel > speechThreshold) {
          hasSpoken.current = true;
          lastVoiceAt.current = now;
        }

        if (!hasSpoken.current && duration > noSpeechLimit) {
          noSpeech.current = true;
          if (recorder.current?.state === "recording") recorder.current.stop();
          return;
        }
        if (hasSpoken.current && duration > 800 && now - lastVoiceAt.current > silence) {
          if (recorder.current?.state === "recording") recorder.current.stop();
          return;
        }
        if (duration > maxDuration && recorder.current?.state === "recording") {
          recorder.current.stop();
        }
      }, 100);
    },
    [stopMonitor, updateStatus],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
    const active = recorder.current;
    if (!active || active.state === "inactive") {
      release();
      updateStatus("idle");
      setLevel(0);
      return;
    }
    updateStatus("stopping");
    active.stop();
  }, [release, updateStatus]);

  const stop = useCallback(() => {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    cancelled.current = false;
    forceSend.current = true;
    updateStatus("stopping");
    try {
      active.stop();
    } catch {
      // Safari иногда бросает, если уже stopping.
    }
  }, [updateStatus]);

  useEffect(
    () => () => {
      generation.current += 1;
      cancelled.current = true;
      const active = recorder.current;
      if (active) {
        active.ondataavailable = null;
        active.onstop = null;
        active.onerror = null;
        if (active.state !== "inactive") {
          try {
            active.stop();
          } catch {
            // ignore
          }
        }
      }
      recorder.current = null;
      release();
    },
    [release],
  );

  async function start() {
    if (statusRef.current !== "idle" || starting.current || stream.current) return;
    setError("");
    setLevel(0);
    setElapsed(0);
    cancelled.current = false;
    noSpeech.current = false;
    forceSend.current = false;
    hasSpoken.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Запись недоступна. Откройте сайт по HTTPS или localhost в современном браузере.");
      return;
    }

    updateStatus("starting");
    starting.current = true;
    const current = generation.current;

    try {
      // Не ждём unlock дольше ~1с: на Safari play() умеет зависать.
      await unlockAudioPlayback();
      if (current !== generation.current) return;

      const source = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (current !== generation.current) {
        source.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = source;

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const context = new (Ctx ?? AudioContext)();
      if (context.state === "suspended") {
        await Promise.race([
          context.resume(),
          new Promise<void>(resolve => globalThis.setTimeout(resolve, 500)),
        ]);
      }
      const node = context.createAnalyser();
      node.fftSize = 2048;
      const input = context.createMediaStreamSource(source);
      input.connect(node);
      audioContext.current = context;
      analyser.current = node;

      const mimeType = pickMimeType();
      let active: MediaRecorder;
      try {
        active = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
      } catch {
        active = new MediaRecorder(source);
      }
      recorder.current = active;
      chunks.current = [];

      active.ondataavailable = event => {
        if (event.data.size) chunks.current.push(event.data);
      };

      active.onerror = () => {
        cancelled.current = true;
        release();
        recorder.current = null;
        updateStatus("idle");
        setLevel(0);
        setError("Не удалось записать звук. Попробуйте ещё раз.");
      };

      active.onstop = () => {
        const wasCancelled = cancelled.current || noSpeech.current;
        const noticedSilence = noSpeech.current;
        const sendAnyway = forceSend.current;
        cancelled.current = false;
        noSpeech.current = false;
        forceSend.current = false;

        release();
        recorder.current = null;
        updateStatus("idle");
        setLevel(0);

        if (wasCancelled) {
          if (noticedSilence) {
            setError("Не услышал речь. Нажмите на ассистента и попробуйте ещё раз.");
          }
          return;
        }

        const type = active.mimeType || chunks.current[0]?.type || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        chunks.current = [];
        if (!blob.size || (!hasSpoken.current && !sendAnyway)) {
          setError("Не услышал речь. Нажмите на ассистента и попробуйте ещё раз.");
          return;
        }
        onCompleteRef.current(blob);
      };

      // timeslice на Safari+mp4 часто ломает запись — без него надёжнее.
      if (isSafari()) {
        active.start();
      } else {
        active.start(250);
      }

      // Таймер стартуем сразу: в Safari `onstart` иногда не приходит,
      // и UI зависает на «Слушаю» с 0:00 без отправки на сервер.
      if (current === generation.current) {
        beginMonitor(current, silenceMs, noSpeechMs, maxMs);
      }
    } catch (cause) {
      if (current !== generation.current) return;
      release();
      recorder.current = null;
      updateStatus("idle");
      setLevel(0);
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Разрешите доступ к микрофону в настройках браузера."
          : "Не удалось включить микрофон. Проверьте его подключение.",
      );
    } finally {
      if (current === generation.current) starting.current = false;
    }
  }

  return { status, level, elapsed, error, start, stop, cancel };
}
