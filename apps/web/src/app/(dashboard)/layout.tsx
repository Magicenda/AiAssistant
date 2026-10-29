import { AuthGate } from "@/features/auth";
import { DashboardSidebar } from "@/widgets/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="bg-background relative isolate min-h-dvh">
        <div className="min-h-dvh lg:flex lg:items-start">
          <DashboardSidebar />
          <div className="relative min-w-0 flex-1 px-3 py-4 sm:px-6 lg:px-8 lg:py-4">
            <div
              aria-hidden="true"
              className="pixel-glow pointer-events-none absolute inset-x-0 top-0 h-[4.25rem]"
            />
            <main className="relative min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
