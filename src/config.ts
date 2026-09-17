export interface AgentConfig {
  model: string;
  headless: boolean;
  maxSteps: number;
  maxElements: number;
  maxPageTextChars: number;
  maxAriaChars: number;
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  settleMs: number;
  completionThreshold: number;
  blockedThreshold: number;
  dangerousThreshold: number;
  minActionConfidence: number;
  minTargetConfidence: number;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

export function loadConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    model: process.env.TYPESAFE_MODEL ?? "jev-latest",
    headless: booleanEnv("JEV_BROWSER_HEADLESS", true),
    maxSteps: numberEnv("JEV_BROWSER_MAX_STEPS", 20),
    maxElements: numberEnv("JEV_BROWSER_MAX_ELEMENTS", 90),
    maxPageTextChars: numberEnv("JEV_BROWSER_MAX_PAGE_TEXT_CHARS", 12_000),
    maxAriaChars: numberEnv("JEV_BROWSER_MAX_ARIA_CHARS", 18_000),
    navigationTimeoutMs: numberEnv("JEV_BROWSER_NAV_TIMEOUT_MS", 20_000),
    actionTimeoutMs: numberEnv("JEV_BROWSER_ACTION_TIMEOUT_MS", 8_000),
    settleMs: numberEnv("JEV_BROWSER_SETTLE_MS", 250),
    completionThreshold: numberEnv("JEV_BROWSER_COMPLETION_THRESHOLD", 0.92),
    blockedThreshold: numberEnv("JEV_BROWSER_BLOCKED_THRESHOLD", 0.92),
    dangerousThreshold: numberEnv("JEV_BROWSER_DANGEROUS_THRESHOLD", 0.82),
    minActionConfidence: numberEnv("JEV_BROWSER_MIN_ACTION_CONFIDENCE", 0.22),
    minTargetConfidence: numberEnv("JEV_BROWSER_MIN_TARGET_CONFIDENCE", 0.18),
    ...overrides,
  };
}
