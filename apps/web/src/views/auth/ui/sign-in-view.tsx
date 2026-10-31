import { AuthForm } from "@/features/auth";
import { AuthShell } from "./auth-shell";

/** Экран входа в аккаунт. */
export function SignInView() {
  return (
    <AuthShell
      title="С возвращением"
      text="Войдите, чтобы продолжить работу с чатом и планировщиком."
    >
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
