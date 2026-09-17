import type { AgentConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { PlaywrightDriver } from "../browser/playwright-driver.js";
import { DecisionEngine } from "../typesafe/decision-engine.js";
import type { Decision, PageState, RunInput, RunResult, StepTrace } from "../types.js";
import { buildValueCandidates, decodeOptionKey, isHighRiskElement } from "./utils.js";

export async function runTask(
  input: RunInput,
  configOverrides: Partial<AgentConfig> = {},
): Promise<RunResult> {
  validateInput(input);
  const config = loadConfig({
    ...configOverrides,
    ...(typeof input.headless === "boolean" ? { headless: input.headless } : {}),
    ...(typeof input.maxSteps === "number" ? { maxSteps: input.maxSteps } : {}),
  });

  const driver = new PlaywrightDriver(config);
  const engine = new DecisionEngine(config);
  const values = buildValueCandidates(input.task, input.variables);
  const steps: StepTrace[] = [];
  let lastPage: PageState | undefined;

  try {
    await driver.start(input.url);

    for (let step = 1; step <= config.maxSteps; step += 1) {
      const page = await driver.observe();
      lastPage = page;
      const decision = await engine.decide(input.task, page, values, steps);

      if (decision.completionProbability >= config.completionThreshold) {
        return result(
          "completed",
          input,
          page,
          steps,
          "Task completion detected on the current page.",
        );
      }
      if (
        decision.action === "finish" &&
        decision.actionConfidence >= config.minActionConfidence &&
        decision.completionProbability >= 0.6
      ) {
        return result(
          "completed",
          input,
          page,
          steps,
          "Task completion selected with supporting completion probability.",
        );
      }
      if (decision.blockedProbability >= config.blockedThreshold) {
        return result(
          "blocked",
          input,
          page,
          steps,
          "Progress is blocked by verification, missing user data, or an unsupported interaction.",
        );
      }
      if (decision.action === "fail") {
        return result(
          "failed",
          input,
          page,
          steps,
          "TypeSafe determined that no supported action can make progress.",
        );
      }
      if (decision.actionConfidence < config.minActionConfidence) {
        steps.push(
          trace(step, page, decision, "Low action confidence; waiting once before retrying."),
        );
        await driver.wait();
        continue;
      }

      const target = decision.targetId
        ? page.elements.find((element) => element.id === decision.targetId)
        : undefined;
      const canCauseExternalEffect = decision.action === "click" || decision.action === "select";
      const risky =
        canCauseExternalEffect &&
        (decision.dangerousProbability >= config.dangerousThreshold || isHighRiskElement(target));
      if (risky && !input.allowDangerous) {
        steps.push(
          trace(step, page, decision, "High-impact action requires explicit allowDangerous=true."),
        );
        return result(
          "requires_confirmation",
          input,
          page,
          steps,
          "Stopped before a potentially irreversible or high-impact action.",
        );
      }

      const execution = await executeDecision(driver, page, decision, values, config);
      steps.push(trace(step, page, decision, execution.note, execution.valueSource));
    }

    lastPage = await driver.observe();
    return result("max_steps", input, lastPage, steps, `Stopped after ${config.maxSteps} steps.`);
  } catch (error) {
    const page = lastPage ?? {
      url: input.url,
      title: "",
      text: "",
      aria: "",
      elements: [],
    };
    return result(
      "failed",
      input,
      page,
      steps,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await driver.close().catch(() => undefined);
  }
}

async function executeDecision(
  driver: PlaywrightDriver,
  page: PageState,
  decision: Decision,
  values: ReturnType<typeof buildValueCandidates>,
  config: AgentConfig,
): Promise<{ note?: string; valueSource?: string }> {
  switch (decision.action) {
    case "click": {
      requireTarget(decision, config);
      await driver.click(decision.targetId as string);
      return {};
    }
    case "fill": {
      requireTarget(decision, config);
      if (
        !decision.valueCandidateId ||
        decision.valueConfidence === undefined ||
        decision.valueConfidence < config.minTargetConfidence
      ) {
        throw new Error(
          "TypeSafe selected fill but did not select a sufficiently confident supplied value.",
        );
      }
      const candidate = values.find((item) => item.id === decision.valueCandidateId);
      if (!candidate) throw new Error(`Unknown fill value candidate: ${decision.valueCandidateId}`);
      await driver.fill(decision.targetId as string, candidate.value);
      return { valueSource: candidate.id };
    }
    case "select": {
      if (
        !decision.selectOptionKey ||
        decision.selectOptionConfidence === undefined ||
        decision.selectOptionConfidence < config.minTargetConfidence
      ) {
        throw new Error(
          "TypeSafe selected select but did not choose a sufficiently confident option.",
        );
      }
      const decoded = decodeOptionKey(decision.selectOptionKey);
      if (!decoded) throw new Error("Invalid select option key returned by TypeSafe.");
      const exists = page.elements.some(
        (element) =>
          element.id === decoded.elementId &&
          element.options?.some(
            (option) => option.value === decoded.value && !option.disabled,
          ),
      );
      if (!exists) throw new Error("Selected option is no longer present on the page.");
      await driver.select(decoded.elementId, decoded.value);
      return {};
    }
    case "scroll_down":
      await driver.scroll("down");
      return {};
    case "scroll_up":
      await driver.scroll("up");
      return {};
    case "back":
      await driver.back();
      return {};
    case "wait":
      await driver.wait();
      return {};
    case "finish":
    case "fail":
      return {};
  }
}

function requireTarget(decision: Decision, config: AgentConfig): void {
  if (
    !decision.targetId ||
    decision.targetConfidence === undefined ||
    decision.targetConfidence < config.minTargetConfidence
  ) {
    throw new Error(`${decision.action} selected without a sufficiently confident target.`);
  }
}

function trace(
  step: number,
  page: PageState,
  decision: Decision,
  note?: string,
  valueSource?: string,
): StepTrace {
  return {
    step,
    url: page.url,
    action: decision.action,
    ...(decision.targetId ? { target: decision.targetId } : {}),
    ...(valueSource ? { valueSource } : {}),
    actionConfidence: decision.actionConfidence,
    ...(decision.targetConfidence !== undefined
      ? { targetConfidence: decision.targetConfidence }
      : {}),
    completionProbability: decision.completionProbability,
    blockedProbability: decision.blockedProbability,
    dangerousProbability: decision.dangerousProbability,
    ...(note ? { note } : {}),
  };
}

function result(
  status: RunResult["status"],
  input: RunInput,
  page: PageState,
  steps: StepTrace[],
  message: string,
): RunResult {
  return {
    status,
    task: input.task,
    startUrl: input.url,
    finalUrl: page.url,
    finalTitle: page.title,
    steps,
    finalText: page.text,
    message,
  };
}

function validateInput(input: RunInput): void {
  if (!input || typeof input !== "object") throw new Error("Input is required.");
  if (typeof input.url !== "string" || !input.url.trim()) throw new Error("url is required.");
  if (typeof input.task !== "string" || !input.task.trim()) throw new Error("task is required.");
  const url = new URL(input.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  if (
    input.maxSteps !== undefined &&
    (!Number.isInteger(input.maxSteps) || input.maxSteps < 1 || input.maxSteps > 100)
  ) {
    throw new Error("maxSteps must be an integer between 1 and 100.");
  }
}
