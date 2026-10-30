"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiConfig } from "@/shared/config";
import { ApiError } from "@/shared/api/http";
import {
  askByVoice,
  createRemoteChat,
  getChat,
  getSpeechJob,
  updateRemoteChat,
} from "@/features/assistant";
import { speakText } from "@/features/voice-playback";
import { useVoiceRecorder } from "./use-voice-recorder";
import { turnsFromHistory, voiceChatTitle, type VoiceTurn } from "./turns";

/** Фазы ответа ассистента; прослушивание добавляется поверх по статусу микрофона. */
export type VoicePhase = "idle" | "transcribing" | "thinking" | "speaking" | "error";

export interface VoiceSession {
  /** Фаза обработки ответа. */
  phase: VoicePhase;
  /** Фаза для интерфейса: во время записи всегда `listening`. */
  displayPhase: VoicePhase | "listening";
  /** Реплики текущего диалога. */
  turns: VoiceTurn[];
  /** id чата на backend; `null`, пока не сказана первая фраза. */
  chatId: string | null;
  /** Громкость микрофона 0–1 для анимации ассистента. */
  level: number;
  /** Длительность текущей записи в секундах. */
  elapsed: number;
  /** Текст ошибки для показа под ассистентом. */
  error: string;
  /** Автоматически включать микрофон после ответа. */
  autoListen: boolean;
  /** Есть ли уже готовый ответ для повторного прослушивания. */
  hasAudio: boolean;
  /** История чата ещё загружается. */
  loading: boolean;
  /** Кнопка ассистента: начать/отправить/перебить/отменить. */
  toggle: () => void;
  /** Переключатель автослушивания. */
  toggleAutoListen: () => void;
  /** Повторить последний ответ. */
  replay: () => void;
}

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

/** Ждёт паузу между опросами job; отмена пробрасывается как `AbortError`. */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(abortError());
    };
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Ведёт голосовой диалог ('use client': микрофон, job `/voice/ask` и проигрывание).
 * Вопрос и ответ сохраняет backend, поэтому диалог виден и в текстовом чате.
 *
 * @param initialChatId - существующий чат для продолжения, если открыт из текстового режима.
 * @returns Состояние диалога и действия для экрана голосового режима.
 */
export function useVoiceSession(initialChatId?: string): VoiceSession {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [error, setError] = useState("");
  const [autoListen, setAutoListen] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialChatId));

  const mounted = useRef(true);
  const chatRef = useRef<string | null>(initialChatId ?? null);
  // Чат создан этим экраном: первый заголовок возьмём из распознанной фразы.
  const createdChat = useRef(false);
  const usedTurns = useRef(new Set<string>());
  const jobController = useRef<AbortController | null>(null);
  const speechController = useRef<AbortController | null>(null);
  const lastReply = useRef("");
  const listenTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const autoListenRef = useRef(true);
  const scheduleListenRef = useRef<(delay?: number) => void>(() => undefined);

  const changePhase = useCallback((next: VoicePhase) => {
    if (mounted.current) setPhase(next);
  }, []);

  const addTurn = useCallback((id: string, role: VoiceTurn["role"], text: string) => {
    if (!text.trim() || usedTurns.current.has(id)) return;
    usedTurns.current.add(id);
    setTurns(previous => [...previous, { id, role, text }]);
  }, []);

  const stopSpeech = useCallback(() => {
    speechController.current?.abort();
    speechController.current = null;
  }, []);

  const speakReply = useCallback(
    async (text: string) => {
      if (!text.trim() || !mounted.current) return;
      stopSpeech();
      const controller = new AbortController();
      speechController.current = controller;
      lastReply.current = text;
      setHasAudio(true);
      changePhase("speaking");
      try {
        // Ответ звучит по кускам: первая фраза — сразу, остальные готовятся следом.
        await speakText(text, { signal: controller.signal });
        if (speechController.current !== controller) return;
        speechController.current = null;
        changePhase("idle");
        scheduleListenRef.current(400);
      } catch (cause) {
        if (speechController.current !== controller) return;
        speechController.current = null;
        if (controller.signal.aborted) {
          changePhase("idle");
          return;
        }
        if (cause instanceof DOMException && cause.name === "NotAllowedError") {
          changePhase("idle");
          setError("Браузер заблокировал звук. Нажмите «Повторить».");
          return;
        }
        setError(
          cause instanceof Error && cause.message ? cause.message : "Не удалось озвучить ответ.",
        );
        changePhase("error");
      }
    },
    [changePhase, stopSpeech],
  );

  const pollJob = useCallback(
    async (jobId: string, targetChatId: string, controller: AbortController) => {
      const signal = controller.signal;
      const deadline = Date.now() + apiConfig.limits.jobPollTimeoutMs;
      let userAdded = false;
      let assistantAdded = false;

      while (Date.now() < deadline) {
        const job = await getSpeechJob(jobId, signal);

        if (job.transcript && !userAdded) {
          userAdded = true;
          addTurn(`${jobId}:user`, "user", job.transcript);
          if (createdChat.current) {
            createdChat.current = false;
            // Название чата в списке — по первой фразе, как в текстовом режиме.
            void updateRemoteChat(Number(targetChatId), {
              name_chat: voiceChatTitle(job.transcript),
            }).catch(() => undefined);
          }
        }

        if (job.agent_reply_text && !assistantAdded) {
          assistantAdded = true;
          addTurn(`${jobId}:assistant`, "assistant", job.agent_reply_text);
          // Голос сервер не синтезирует: начинаем говорить сразу, по кускам.
          void speakReply(job.agent_reply_text);
        }

        if (job.status === "failed") {
          throw new Error(job.error || "Не удалось получить ответ.");
        }

        if (job.status === "completed") {
          if (!assistantAdded && job.agent_reply_text) {
            addTurn(`${jobId}:assistant`, "assistant", job.agent_reply_text);
            void speakReply(job.agent_reply_text);
          }
          return;
        }

        // После появления текста фазой управляет озвучка, а не статус job.
        if (!assistantAdded) {
          changePhase(
            job.status === "speaking"
              ? "speaking"
              : job.status === "transcribing"
                ? "transcribing"
                : "thinking",
          );
        }
        await wait(apiConfig.limits.jobPollIntervalMs, signal);
      }
      throw new Error("Ответ не успел подготовиться. Попробуйте ещё раз.");
    },
    [addTurn, changePhase, speakReply],
  );

  const handleClip = useCallback(
    async (clip: Blob) => {
      if (!mounted.current) return;
      setError("");
      changePhase("transcribing");

      const controller = new AbortController();
      jobController.current?.abort();
      jobController.current = controller;

      try {
        let id = chatRef.current;
        if (!id) {
          const created = await createRemoteChat("Голосовой чат");
          id = String(created);
          chatRef.current = id;
          createdChat.current = true;
          if (mounted.current) setChatId(id);
        }
        // speak=false: полную озвучку сервер не делает, фронтенд говорит по кускам.
        const jobId = await askByVoice(Number(id), clip, false, controller.signal);
        await pollJob(jobId, id, controller);
      } catch (cause) {
        if (controller.signal.aborted || !mounted.current) return;
        stopSpeech();
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Не удалось получить голосовой ответ.",
        );
        changePhase("error");
      } finally {
        if (jobController.current === controller) jobController.current = null;
      }
    },
    [changePhase, pollJob, stopSpeech],
  );

  const {
    status: recorderStatus,
    level,
    elapsed,
    error: recorderError,
    start: startRecording,
    stop: stopRecording,
  } = useVoiceRecorder({ onComplete: handleClip });

  const startListening = useCallback(() => {
    if (!mounted.current) return;
    setError("");
    changePhase("idle");
    void startRecording();
  }, [changePhase, startRecording]);

  const scheduleListen = useCallback(
    (delay = 400) => {
      if (!autoListenRef.current) return;
      if (listenTimer.current) globalThis.clearTimeout(listenTimer.current);
      listenTimer.current = globalThis.setTimeout(() => {
        listenTimer.current = null;
        if (mounted.current) startListening();
      }, delay);
    },
    [startListening],
  );
  useEffect(() => {
    scheduleListenRef.current = scheduleListen;
  }, [scheduleListen]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      jobController.current?.abort();
      speechController.current?.abort();
      speechController.current = null;
      if (listenTimer.current) globalThis.clearTimeout(listenTimer.current);
      listenTimer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!initialChatId) return;
    let cancelled = false;
    void getChat(Number(initialChatId))
      .then(chat => {
        if (cancelled || !mounted.current) return;
        const history = turnsFromHistory(chat.messages);
        for (const turn of history) usedTurns.current.add(turn.id);
        setTurns(history);
        setLoading(false);
      })
      .catch(cause => {
        if (cancelled || !mounted.current) return;
        // Чат удалили, пока ссылка была в закладке: голосовой режим начнёт новый диалог.
        const missing = cause instanceof ApiError && cause.status === 404;
        if (missing) {
          chatRef.current = null;
          setChatId(null);
        }
        setError(
          missing
            ? "Чат не найден — начнётся новый голосовой диалог."
            : cause instanceof Error && cause.message
              ? cause.message
              : "Не удалось загрузить историю.",
        );
        if (!missing) changePhase("error");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [changePhase, initialChatId]);

  const listening =
    recorderStatus === "starting" ||
    recorderStatus === "recording" ||
    recorderStatus === "stopping";

  const toggle = useCallback(() => {
    if (listening) {
      stopRecording();
      return;
    }
    if (phase === "transcribing" || phase === "thinking") {
      jobController.current?.abort();
      stopSpeech();
      changePhase("idle");
      return;
    }
    if (phase === "speaking") {
      // Перебиваем ответ и сразу слушаем новую реплику.
      stopSpeech();
      changePhase("idle");
      startListening();
      return;
    }
    startListening();
  }, [changePhase, listening, phase, startListening, stopRecording, stopSpeech]);

  const toggleAutoListen = useCallback(() => {
    const next = !autoListenRef.current;
    autoListenRef.current = next;
    setAutoListen(next);
    if (!next && listenTimer.current) {
      // Выключили автослушание — отменяем уже запланированный запуск микрофона.
      globalThis.clearTimeout(listenTimer.current);
      listenTimer.current = null;
    }
  }, []);

  const replay = useCallback(() => {
    const text = lastReply.current;
    if (text) void speakReply(text);
  }, [speakReply]);

  const displayPhase: VoicePhase | "listening" = listening
    ? "listening"
    : recorderError && phase === "idle"
      ? "error"
      : phase;

  return {
    phase,
    displayPhase,
    turns,
    chatId,
    level,
    elapsed,
    error: recorderError || error,
    autoListen,
    hasAudio,
    loading,
    toggle,
    toggleAutoListen,
    replay,
  };
}
