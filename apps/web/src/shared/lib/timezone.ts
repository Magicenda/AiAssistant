/** Возвращает IANA-часовой пояс браузера; при ошибке — UTC. */
export function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
