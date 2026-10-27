"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceClip = { dataUrl: string; type: string; duration: number };

type Status = "idle" | "starting" | "recording" | "stopping";

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать запись."));
    reader.readAsDataURL(blob);
  });
}

export function useAudioRecording() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const resolveStop = useRef<((clip: VoiceClip | null) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      clearTimer();
      const active = recorder.current;
      if (active) {
        active.onstart = null;
        active.ondataavailable = null;
        active.onstop = null;
        active.onerror = null;
        if (active.state !== "inactive") active.stop();
      }
      releaseStream();
      recorder.current = null;
      resolveStop.current = null;
    },
    [clearTimer, releaseStream],
  );

  async function start() {
    if (status !== "idle" || starting.current || stream.current) return;
    setError("");
    setElapsed(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Запись недоступна. Откройте сайт по HTTPS или localhost в современном браузере.");
      return;
    }
    setStatus("starting");
    starting.current = true;
    const current = generation.current;
    try {
      const source = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== generation.current) {
        source.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = source;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type =>
        MediaRecorder.isTypeSupported(type),
      );
      const active = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
      recorder.current = active;
      chunks.current = [];
      let failed = false;

      active.onstart = () => {
        if (current !== generation.current || failed) return;
        startedAt.current = Date.now();
        setElapsed(0);
        setStatus("recording");
        timer.current = setInterval(() => {
          setElapsed(Math.round((Date.now() - startedAt.current) / 100) / 10);
        }, 100);
      };
      active.ondataavailable = event => {
        if (event.data.size) chunks.current.push(event.data);
      };
      active.onerror = () => {
        failed = true;
        clearTimer();
        releaseStream();
        setStatus("idle");
        setError("Не удалось записать звук. Попробуйте ещё раз.");
        resolveStop.current?.(null);
        resolveStop.current = null;
      };
      active.onstop = () => {
        clearTimer();
        releaseStream();
        recorder.current = null;
        setStatus("idle");
        const duration = Math.round((Date.now() - startedAt.current) / 100) / 10;
        const done = resolveStop.current;
        resolveStop.current = null;
        if (failed || !done) return;
        const type = active.mimeType || chunks.current[0]?.type || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        if (!blob.size) {
          setError("Запись пустая. Попробуйте записать ещё раз.");
          done(null);
          return;
        }
        readAsDataUrl(blob)
          .then(dataUrl => done({ dataUrl, type, duration }))
          .catch(() => {
            setError("Не удалось сохранить запись.");
            done(null);
          });
      };
      active.start(1000);
    } catch (cause) {
      if (current !== generation.current) return;
      clearTimer();
      releaseStream();
      recorder.current = null;
      setStatus("idle");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Разрешите доступ к микрофону в настройках браузера."
          : "Не удалось включить микрофон. Проверьте его подключение и доступ к нему.",
      );
    } finally {
      if (current === generation.current) starting.current = false;
    }
  }

  function stop() {
    return new Promise<VoiceClip | null>(resolve => {
      if (recorder.current?.state !== "recording") {
        resolve(null);
        return;
      }
      resolveStop.current = resolve;
      setStatus("stopping");
      recorder.current.stop();
    });
  }

  return { status, error, elapsed, start, stop };
}
