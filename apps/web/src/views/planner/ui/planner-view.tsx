import { Planner } from "@/features/planner";

export function PlannerView({
  section,
}: {
  section: "plans" | "tasks" | "meetings" | "reminders" | "search";
}) {
  return <Planner key={section} section={section} />;
}
