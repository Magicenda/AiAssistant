"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const speechThreshold = 0.03;

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

/**
 * Записывает голос для голосового режима ('use client': `MediaRecorder` и Web Audio).
 * Останавливается сама после паузы в речи и не отправляет тишину.
 *
 * @param options - Колбэк готовой записи и тайминги автоостановки.
 * @returns Статус, громкость, длительность и управление записью.
 */
export function useVoiceRecorder({
  onComplete,
  silenceMs = 1200,
  noSpeechMs = 8000,
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
  const starting = useRef(false);
  const statusRef = useRef<RecorderStatus>("idle");
  // Счётчик «поколений»: колбэки устаревшего запуска не должны менять состояние.
  const generation = useRef(0);

  const updateStatus = useCallback((next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const release = useCallback(() => {
    if (monitor.current !== null) {
      clearInterval(monitor.current);
      monitor.current = null;
    }
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    analyser.current = null;
    const context = audioContext.current;
    audioContext.current = null;
    if (context) void context.close().catch(() => undefined);
  }, []);

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
    updateStatus("stopping");
    active.stop();
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
        if (active.state !== "inactive") active.stop();
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
    hasSpoken.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Запись недоступна. Откройте сайт по HTTPS или localhost в современном браузере.");
      return;
    }

    updateStatus("starting");
    starting.current = true;
    const current = generation.current;

    try {
      const source = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (current !== generation.current) {
        source.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = source;

      const context = new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 1024;
      const input = context.createMediaStreamSource(source);
      input.connect(node);
      audioContext.current = context;
      analyser.current = node;

      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type =>
        MediaRecorder.isTypeSupported(type),
      );
      const active = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
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
        cancelled.current = false;
        noSpeech.current = false;

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
        if (!blob.size || !hasSpoken.current) {
          setError("Не услышал речь. Нажмите на ассистента и попробуйте ещё раз.");
          return;
        }
        onCompleteRef.current(blob);
      };

      active.onstart = () => {
        if (current !== generation.current) return;
        startedAt.current = Date.now();
        lastVoiceAt.current = startedAt.current;
        setElapsed(0);
        updateStatus("recording");

        monitor.current = setInterval(() => {
          if (current !== generation.current || !analyser.current) return;
          const now = Date.now();
          const duration = now - startedAt.current;
          const currentLevel = readLevel(analyser.current);
          setLevel(currentLevel);
          setElapsed(Math.round(duration / 100) / 10);

          if (currentLevel > speechThreshold) {
            hasSpoken.current = true;
            lastVoiceAt.current = now;
          }

          if (!hasSpoken.current && duration > noSpeechMs) {
            noSpeech.current = true;
            if (recorder.current?.state === "recording") recorder.current.stop();
            return;
          }
          if (hasSpoken.current && duration > 800 && now - lastVoiceAt.current > silenceMs) {
            if (recorder.current?.state === "recording") recorder.current.stop();
            return;
          }
          if (duration > maxMs && recorder.current?.state === "recording") {
            recorder.current.stop();
          }
        }, 100);
      };

      active.start(250);
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
