"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, setUnauthorizedHandler } from "@/shared/api";

/** Экран проверки доступа: не даёт смонтировать кабинет до чтения токена. */
function AuthSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center font-mono text-xs tracking-wider uppercase"
    >
      Проверка доступа…
    </div>
  );
}

/**
 * Пускает в кабинет только с JWT; на `401` уводит на страницу входа.
 * До проверки токена дочерние экраны не монтируются, поэтому дашборд
 * не успевает мигнуть без авторизации и не отправляет лишние запросы.
 *
 * @param props - Дочерние экраны кабинета.
 * @returns Дочерние экраны после успешной проверки или экран ожидания.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Токен живёт в localStorage, поэтому проверить его можно только после гидрации.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getAccessToken()) setReady(true);
    else router.replace("/sign-in");

    setUnauthorizedHandler(() => {
      setReady(false);
      router.replace("/sign-in");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  if (!ready) return <AuthSplash />;
  return <>{children}</>;
}
