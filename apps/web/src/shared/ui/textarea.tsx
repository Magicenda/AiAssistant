import * as React from "react";

import { cn } from "@/shared/lib/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-border bg-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex w-full border-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
