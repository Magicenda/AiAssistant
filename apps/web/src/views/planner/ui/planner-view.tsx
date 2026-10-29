import { Planner } from "@/features/planner";

/** Экран планировщика: раздел определяет фильтр записей и заголовок. */
export function PlannerView({
  section,
}: {
  section: "plans" | "tasks" | "meetings" | "reminders" | "search";
}) {
  return <Planner key={section} section={section} />;
}
