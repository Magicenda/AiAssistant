import { LogIn } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function AuthForm() {
  return (
    <form className="space-y-4">
      <Input type="email" placeholder="Email" />
      <Input type="password" placeholder="Пароль" />
      <Button type="submit" className="w-full">
        <LogIn className="size-4" />
        Продолжить
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Заглушка. Логика авторизации — в слое features.
      </p>
    </form>
  );
}
