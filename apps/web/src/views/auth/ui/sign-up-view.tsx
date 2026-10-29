import { AuthForm } from "@/features/auth";

export function SignUpView() {
  return (
    <section className="w-full max-w-sm space-y-6">
      <h1 className="text-center text-2xl font-bold">Регистрация</h1>
      <AuthForm mode="sign-up" />
    </section>
  );
}
