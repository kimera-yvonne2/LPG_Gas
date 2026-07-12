/** Turn DRF's nested validation/error response into safe display text. */
export function apiErrorMessage(value: unknown, fallback: string): string {
  const messages: string[] = [];

  function collect(current: unknown, field?: string) {
    if (field === "code") return;
    if (typeof current === "string") {
      messages.push(field && !["detail", "non_field_errors", "errors"].includes(field) ? `${label(field)}: ${current}` : current);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(item => collect(item, field));
      return;
    }
    if (current && typeof current === "object") {
      Object.entries(current as Record<string, unknown>).forEach(([key, item]) => collect(item, key));
    }
  }

  collect(value);
  return messages.length ? [...new Set(messages)].join(" ") : fallback;
}

function label(field: string) {
  return field.replaceAll("_", " ").replace(/^./, character => character.toUpperCase());
}
