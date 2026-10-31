import { AuthForm } from "@/features/auth";
import { AuthShell } from "./auth-shell";

/** Экран регистрации. */
export function SignUpView() {
  return (
    <AuthShell
      title="Создать аккаунт"
      text="Зарегистрируйтесь, чтобы хранить чаты и записи планировщика."
    >
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
