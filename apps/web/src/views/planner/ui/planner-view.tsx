import { Planner } from "@/features/planner";

export function PlannerView({ section }: {
  section: "plans" | "tasks" | "meetings" | "reminders" | "search" | "settings";
}) {
  return <Planner key={section} section={section} />;
}
