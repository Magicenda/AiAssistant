export interface ValidationIssue {
  loc: unknown[];
  msg: string;
  type: string;
}

export function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.loc) && typeof item.msg === "string" && typeof item.type === "string";
}

export function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.length > 0) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.filter(isValidationIssue).map(issue => {
      const field = issue.loc.at(-1);
      return field === undefined ? issue.msg : `${String(field)}: ${issue.msg}`;
    });
    if (messages.length > 0) return messages.join(", ");
  }
  return null;
}
