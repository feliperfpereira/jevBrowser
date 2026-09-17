import type { ActionableElement, ValueCandidate } from "../types.js";

export function buildValueCandidates(
  task: string,
  variables: Record<string, string> = {},
): ValueCandidate[] {
  const candidates: ValueCandidate[] = [];
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(variables)) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    candidates.push({
      id: `var_${sanitizeId(key)}`,
      description: `Use the caller-provided variable named ${JSON.stringify(key)}. Its value is intentionally hidden from the model.`,
      value,
      secret: true,
    });
  }

  const patterns = [
    /"([^"\n]{1,300})"/g,
    /'([^'\n]{1,300})'/g,
    /`([^`\n]{1,300})`/g,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /https?:\/\/[^\s)\]}>,]+/gi,
  ];

  for (const pattern of patterns) {
    for (const match of task.matchAll(pattern)) {
      const value = (match[1] ?? match[0]).trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      candidates.push({
        id: `literal_${candidates.length + 1}`,
        description: `Literal value already present in the task: ${JSON.stringify(value)}`,
        value,
        secret: false,
      });
      if (candidates.length >= 24) return candidates;
    }
  }

  return candidates;
}

export function isFillable(element: ActionableElement): boolean {
  return (
    (!element.disabled && ["textbox", "searchbox"].includes(element.role)) ||
    (!element.disabled &&
      ["input", "textarea"].includes(element.tag) &&
      !["button", "submit", "checkbox", "radio"].includes(element.type ?? ""))
  );
}

export function isSelectable(element: ActionableElement): boolean {
  return (
    !element.disabled &&
    element.tag === "select" &&
    Boolean(element.options?.some((option) => !option.disabled))
  );
}

export function isClickable(element: ActionableElement): boolean {
  if (element.disabled) return false;
  if (["link", "button", "checkbox", "radio", "tab", "menuitem"].includes(element.role)) {
    return true;
  }
  return (
    element.tag === "a" ||
    element.tag === "button" ||
    ["button", "submit", "reset", "checkbox", "radio"].includes(element.type ?? "")
  );
}

export function isHighRiskElement(element: ActionableElement | undefined): boolean {
  if (!element) return false;
  const text = `${element.name} ${element.role} ${element.type ?? ""}`.toLowerCase();
  return /\b(buy now|place order|confirm order|purchase|pay now|send payment|transfer|wire|delete|erase|close account|publish|send message|send email|post now|book now|reserve now)\b/.test(
    text,
  );
}

export function optionKey(elementId: string, value: string): string {
  return `${elementId}::${Buffer.from(value).toString("base64url")}`;
}

export function decodeOptionKey(
  key: string,
): { elementId: string; value: string } | undefined {
  const separator = key.indexOf("::");
  if (separator < 1) return undefined;
  try {
    return {
      elementId: key.slice(0, separator),
      value: Buffer.from(key.slice(separator + 2), "base64url").toString("utf8"),
    };
  } catch {
    return undefined;
  }
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 48) || "value";
}
