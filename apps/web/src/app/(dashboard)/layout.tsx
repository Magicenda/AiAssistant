import { DashboardSidebar } from "@/widgets/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <DashboardSidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
