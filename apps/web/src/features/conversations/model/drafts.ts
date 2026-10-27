const key = "assistant-drafts-v1";

function readAll(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, string> = {};
    for (const [id, text] of Object.entries(value as Record<string, unknown>)) {
      if (typeof text === "string") result[id] = text;
    }
    return result;
  } catch {
    return {};
  }
}

export function readDraft(id: string): string {
  return readAll()[id] ?? "";
}

export function writeDraft(id: string, text: string) {
  const all = readAll();
  if (text) all[id] = text;
  else delete all[id];
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* квота не критична: черновик не должен ломать ввод */
  }
}

export function removeDraft(id: string) {
  const all = readAll();
  if (!(id in all)) return;
  delete all[id];
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* см. writeDraft */
  }
}
