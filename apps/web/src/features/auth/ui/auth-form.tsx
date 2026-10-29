"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ApiError, setAccessToken } from "@/shared/api";
import { login, register } from "../api";

/** Форма входа/регистрации; хранит JWT и переходит в чат. */
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      if (mode === "sign-up") await register(username.trim(), password);
      const token = await login(username.trim(), password);
      setAccessToken(token.access_token);
      router.replace("/chat");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось выполнить запрос.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        required
        autoComplete="username"
        aria-label="Имя пользователя"
        placeholder="Имя пользователя"
        value={username}
        onChange={event => setUsername(event.target.value)}
      />
      <Input
        required
        type="password"
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        aria-label="Пароль"
        placeholder="Пароль"
        value={password}
        onChange={event => setPassword(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        <LogIn className="size-4" />
        {pending ? "Отправка…" : mode === "sign-up" ? "Создать аккаунт" : "Войти"}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        {mode === "sign-up" ? (
          <>
            Уже есть аккаунт?{" "}
            <Link href="/sign-in" className="text-primary underline underline-offset-4">
              Войти
            </Link>
          </>
        ) : (
          <>
            Нет аккаунта?{" "}
            <Link href="/sign-up" className="text-primary underline underline-offset-4">
              Зарегистрироваться
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
