import { PlannerView } from "@/views/planner";

export const metadata = { title: "Задачи" };

export default function Page() {
  return <PlannerView section="tasks" />;
}
