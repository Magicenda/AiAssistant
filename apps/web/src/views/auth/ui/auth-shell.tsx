import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/shared/ui/logo";

interface AuthShellProps {
  /** Надзаголовок формы. */
  eyebrow: string;
  /** Заголовок экрана. */
  title: string;
  /** Короткое пояснение под заголовком. */
  text: string;
  /** Форма входа или регистрации. */
  children: ReactNode;
}

/** Общая пиксельная рамка для экранов входа и регистрации. */
export function AuthShell({ eyebrow, title, text, children }: AuthShellProps) {
  return (
    <section className="pixel-panel w-full max-w-md p-6 sm:p-8">
      <Link href="/" className="flex w-fit items-center gap-2">
        <Logo className="text-primary size-5" />
        <span className="font-pixel text-foreground text-xs">AI Assistant</span>
      </Link>

      <p className="text-primary mt-7 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
        {eyebrow}
      </p>
      <h1 className="font-pixel text-foreground mt-2 text-2xl sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground mt-2 font-mono text-xs leading-relaxed">{text}</p>

      <div className="mt-6">{children}</div>

      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mt-5 inline-block font-mono text-xs underline underline-offset-4"
      >
        На главную
      </Link>
    </section>
  );
}
