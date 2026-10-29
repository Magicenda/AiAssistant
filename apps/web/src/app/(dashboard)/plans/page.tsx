import { PlannerView } from "@/views/planner";

export const metadata = { title: "Мои планы" };

export default function Page() {
  return <PlannerView section="plans" />;
}
