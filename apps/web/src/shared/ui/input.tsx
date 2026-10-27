import * as React from "react";

import { cn } from "@/shared/lib/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "border-border bg-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full border-2 px-3 py-1 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
