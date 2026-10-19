import { User } from "lucide-react";

export function ProfileView() {
  return (
    <section className="space-y-6 p-8">
      <h1 className="text-3xl font-bold">Профиль</h1>
      <div className="bg-muted flex items-center gap-4 rounded-xl p-6">
        <div className="bg-background flex size-16 items-center justify-center rounded-full border">
          <User className="size-8" />
        </div>
        <div>
          <p className="font-semibold">Имя пользователя</p>
          <p className="text-muted-foreground text-sm">user@example.com</p>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Заглушка. Здесь: настройки аккаунта, история чатов, тариф.
      </p>
    </section>
  );
}
