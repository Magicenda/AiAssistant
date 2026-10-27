import { cn } from "@/shared/lib/cn";

/** Логотип приложения: берёт форму из единственного файла `public/icon.png`,
 *  а цвет — из `currentColor`, чтобы вписываться в любой контекст. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-5 shrink-0 bg-current",
        "[mask-image:url(/icon.png)] [mask-position:center] [mask-repeat:no-repeat]",
        "[mask-size:contain]",
        className,
      )}
    />
  );
}
