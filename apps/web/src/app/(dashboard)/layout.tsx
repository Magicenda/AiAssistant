import { DashboardSidebar } from "@/widgets/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh bg-background">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-32 -top-48 size-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="min-h-dvh lg:flex lg:items-start">
      <DashboardSidebar />
      <div className="min-w-0 flex-1 px-3 py-4 sm:px-6 lg:px-8 lg:py-4">
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
