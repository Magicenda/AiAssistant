import type { ReactNode } from "react";
import Link from "next/link";

interface AuthShellProps {
  /** Заголовок экрана. */
  title: string;
  /** Короткое пояснение под заголовком. */
  text: string;
  /** Форма входа или регистрации. */
  children: ReactNode;
}

/** Общая пиксельная рамка для экранов входа и регистрации. */
export function AuthShell({ title, text, children }: AuthShellProps) {
  return (
    <section className="pixel-panel w-full max-w-md p-6 sm:p-8">
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
