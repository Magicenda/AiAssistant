import { AuthForm } from "@/features/auth";

export function SignInView() {
  return (
    <section className="w-full max-w-sm space-y-6">
      <h1 className="text-center text-2xl font-bold">Вход</h1>
      <AuthForm mode="sign-in" />
    </section>
  );
}
