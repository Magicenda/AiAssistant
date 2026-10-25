"use client";

import { useEffect, useRef, useState } from "react";
import { sendAudio } from "../api/send-audio";

type Recording = { file: File; url: string };

export function useAudioRecording() {
  const [status, setStatus] = useState<"idle" | "starting" | "recording" | "stopping">("idle");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const generation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const upload = useRef<AbortController | null>(null);
  const pendingUpload = useRef(false);
  const starting = useRef(false);

  useEffect(() => {
    return () => {
      generation.current += 1;
      const active = recorder.current;
      if (active) {
        active.onstart = null;
        active.ondataavailable = null;
        active.onstop = null;
        active.onerror = null;
        if (active.state !== "inactive") active.stop();
      }
      stream.current?.getTracks().forEach(track => track.stop());
      recorder.current = null;
      stream.current = null;
      upload.current?.abort();
      pendingUpload.current = false;
      starting.current = false;
    };
  }, []);

  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url);
  }, [recording]);

  async function start() {
    if (status !== "idle" || starting.current || pendingUpload.current || stream.current) return;
    setError("");
    setSent(false);
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
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
        .find(type => MediaRecorder.isTypeSupported(type));
      const active = new MediaRecorder(source, mimeType ? { mimeType } : undefined);
      recorder.current = active;
      const chunks: Blob[] = [];
      let failed = false;
      active.onstart = () => {
        if (current !== generation.current || failed) return;
        setStatus("recording");
      };
      active.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      active.onerror = () => {
        failed = true;
        source.getTracks().forEach(track => track.stop());
        stream.current = null;
        setStatus("idle");
        setError("Не удалось записать звук. Попробуйте ещё раз.");
      };
      active.onstop = () => {
        source.getTracks().forEach(track => track.stop());
        stream.current = null;
        recorder.current = null;
        setStatus("idle");
        if (failed) return;
        const type = active.mimeType || chunks[0]?.type;
        const blob = new Blob(chunks, { type });
        if (!blob.size) {
          setError("Запись пустая. Попробуйте записать ещё раз.");
          return;
        }
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type });
        setRecording({ file, url: URL.createObjectURL(file) });
      };
      active.start(1000);
      setRecording(null);
    } catch (cause) {
      if (current !== generation.current) return;
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
      recorder.current = null;
      setStatus("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Разрешите доступ к микрофону в настройках браузера."
        : "Не удалось включить микрофон. Проверьте его подключение и доступ к нему.");
    } finally {
      if (current === generation.current) starting.current = false;
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") {
      setStatus("stopping");
      recorder.current.stop();
    }
  }

  async function send() {
    if (!recording || pendingUpload.current || status !== "idle") return;
    pendingUpload.current = true;
    setSending(true);
    setError("");
    setSent(false);
    const controller = new AbortController();
    upload.current = controller;
    try {
      await sendAudio(recording.file, controller.signal);
      if (controller.signal.aborted) return;
      setRecording(null);
      setSent(true);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Не удалось отправить запись.");
      }
    } finally {
      if (!controller.signal.aborted) {
        pendingUpload.current = false;
        setSending(false);
      }
    }
  }

  return { status, recording, sending, error, sent, start, stop, send,
    discard: () => { setRecording(null); setError(""); setSent(false); } };
}
