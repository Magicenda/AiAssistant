import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/lib/cn";

const buttonVariants = cva(
  "font-pixel inline-flex items-center justify-center gap-2 whitespace-nowrap uppercase tracking-wide text-[0.75rem] leading-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "pixel-bevel bg-primary text-primary-foreground hover:brightness-110",
        destructive: "pixel-bevel bg-destructive text-white hover:brightness-110",
        outline: "border-2 border-border bg-transparent text-foreground hover:bg-white/5",
        secondary: "pixel-bevel bg-secondary text-secondary-foreground hover:brightness-110",
        ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6 text-[0.9rem]",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Рендерить содержимое через `Slot` — например, для `Link` без вложенного `<button>`. */
  asChild?: boolean;
}

/** Пиксельная кнопка (shadcn); варианты — в `buttonVariants`. */
function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
