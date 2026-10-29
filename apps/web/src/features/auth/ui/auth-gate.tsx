"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, setUnauthorizedHandler } from "@/shared/api";

/** Пускает в кабинет только с JWT; на `401` уводит на страницу входа. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    setUnauthorizedHandler(() => router.replace("/sign-in"));
    if (!getAccessToken()) router.replace("/sign-in");
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return <>{children}</>;
}
