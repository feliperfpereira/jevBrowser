import { TypeSafeClient, choice, noul, type Questions } from "@typesafe-ai/sdk";
import type { AgentConfig } from "../config.js";
import type { BrowserAction, Decision, PageState, StepTrace, ValueCandidate } from "../types.js";
import { isClickable, isFillable, isSelectable, optionKey } from "../agent/utils.js";

const ALL_ACTIONS: Record<BrowserAction, string> = {
  click: "Click a visible actionable element that best advances the task.",
  fill: "Fill a text-like field using one of the supplied value candidates.",
  select: "Choose an option from a visible select/combobox.",
  scroll_down: "Scroll down to reveal more relevant content or controls.",
  scroll_up: "Scroll up to reveal relevant content or controls.",
  back: "Go back to the previous page because the current path is wrong.",
  wait: "Wait briefly because the page is loading or updating.",
  finish: "The requested task is already complete on the current page.",
  fail: "The task cannot be completed with the available page state and supported actions.",
};

export class DecisionEngine {
  private readonly client: TypeSafeClient;

  constructor(private readonly config: AgentConfig) {
    this.client = new TypeSafeClient({ defaultModel: config.model });
  }

  async decide(
    task: string,
    page: PageState,
    values: ValueCandidate[],
    history: StepTrace[],
  ): Promise<Decision> {
    const clickable = page.elements.filter(isClickable);
    const fillable = page.elements.filter(isFillable);
    const selectable = page.elements.filter(isSelectable);

    const selectCriteria: Record<string, string> = {};
    for (const element of selectable) {
      for (const option of element.options ?? []) {
        if (option.disabled || Object.keys(selectCriteria).length >= 190) continue;
        selectCriteria[optionKey(element.id, option.value)] = `Select ${JSON.stringify(option.label)} in ${describeElement(element)}`;
      }
    }

    const actionCriteria: Record<string, string> = {
      ...(clickable.length ? { click: ALL_ACTIONS.click } : {}),
      ...(fillable.length && values.length ? { fill: ALL_ACTIONS.fill } : {}),
      ...(Object.keys(selectCriteria).length ? { select: ALL_ACTIONS.select } : {}),
      scroll_down: ALL_ACTIONS.scroll_down,
      scroll_up: ALL_ACTIONS.scroll_up,
      back: ALL_ACTIONS.back,
      wait: ALL_ACTIONS.wait,
      finish: ALL_ACTIONS.finish,
      fail: ALL_ACTIONS.fail,
    };

    const questions: Questions = {
      complete: noul(
        "Given `task` and the current `page`, is the requested browser task already successfully completed? Be strict: reaching an intermediate page is not completion.",
      ),
      blocked: noul(
        "Is progress on `task` currently blocked by a CAPTCHA/anti-bot challenge, MFA or other user-only verification, missing credentials/data, or an interaction not represented by the available browser elements?",
      ),
      dangerous: noul(
        "Would the single immediate browser action that should happen next from the current `page` itself cause a high-impact or hard-to-reverse external effect, such as placing an order, sending payment, deleting data, publishing/sending content, booking/reserving, transferring funds, or closing an account? Judge only the immediate next action, not the eventual goal.",
      ),
      next_action: choice(
        "Which single browser action best advances `task` from the current `page`? Prefer deterministic progress. Choose finish only when the task is actually complete and fail only when no supported progress is possible.",
        actionCriteria,
      ),
    };

    if (clickable.length) {
      questions.click_target = choice(
        "If the best next action is click, which element best advances `task`? Choose __none__ if none of these should be clicked now.",
        withNone(Object.fromEntries(clickable.map((element) => [element.id, describeElement(element)]))),
      );
    }

    if (fillable.length && values.length) {
      questions.fill_target = choice(
        "If the best next action is fill, which field should receive the next value for `task`? Choose __none__ if no listed field should be filled now.",
        withNone(Object.fromEntries(fillable.map((element) => [element.id, describeElement(element)]))),
      );
      questions.fill_value = choice(
        "If the best next action is fill, which supplied value candidate belongs in the chosen field? Choose __none__ when none is appropriate. Never invent a value.",
        withNone(Object.fromEntries(values.map((candidate) => [candidate.id, candidate.description]))),
      );
    }

    if (Object.keys(selectCriteria).length) {
      questions.select_option = choice(
        "If the best next action is select, which exact control+option pair best advances `task`? Choose __none__ if none is appropriate.",
        withNone(selectCriteria),
      );
    }

    const response = await this.client.systemOne({
      model: this.config.model,
      state: {
        task,
        page: {
          url: page.url,
          title: page.title,
          text: page.text,
          aria: page.aria,
          elements: page.elements.map((element) => ({
            id: element.id,
            role: element.role,
            name: element.name,
            tag: element.tag,
            type: element.type ?? null,
            placeholder: element.placeholder ?? null,
            value: element.value ?? null,
            href: element.href ?? null,
          })),
        },
        available_values: values.map((candidate) => ({ id: candidate.id, description: candidate.description })),
        recent_history: history.slice(-5),
      },
      questions,
    });

    const nextAction = answerChoice(response.answers.next_action);
    const targetAnswer =
      nextAction.choice === "click"
        ? answerChoice(response.answers.click_target)
        : nextAction.choice === "fill"
          ? answerChoice(response.answers.fill_target)
          : undefined;
    const valueAnswer = nextAction.choice === "fill" ? answerChoice(response.answers.fill_value) : undefined;
    const selectAnswer = nextAction.choice === "select" ? answerChoice(response.answers.select_option) : undefined;

    return {
      action: (nextAction.choice ?? "fail") as BrowserAction,
      actionConfidence: nextAction.confidence,
      ...(targetAnswer?.choice ? { targetId: targetAnswer.choice } : {}),
      ...(targetAnswer ? { targetConfidence: targetAnswer.confidence } : {}),
      ...(valueAnswer?.choice ? { valueCandidateId: valueAnswer.choice } : {}),
      ...(valueAnswer ? { valueConfidence: valueAnswer.confidence } : {}),
      ...(selectAnswer?.choice ? { selectOptionKey: selectAnswer.choice } : {}),
      ...(selectAnswer ? { selectOptionConfidence: selectAnswer.confidence } : {}),
      completionProbability: answerNoul(response.answers.complete),
      blockedProbability: answerNoul(response.answers.blocked),
      dangerousProbability: answerNoul(response.answers.dangerous),
    };
  }
}

function describeElement(element: PageState["elements"][number]): string {
  const parts = [
    `role=${element.role}`,
    `name=${JSON.stringify(element.name)}`,
    `tag=${element.tag}`,
  ];
  if (element.type) parts.push(`type=${element.type}`);
  if (element.placeholder) parts.push(`placeholder=${JSON.stringify(element.placeholder)}`);
  if (element.href) parts.push(`href=${element.href}`);
  return parts.join("; ");
}

function withNone(criteria: Record<string, string>): Record<string, string> {
  return { ...criteria, __none__: "None of the listed options is appropriate right now." };
}

function answerChoice(answer: unknown): { choice?: string; confidence: number } {
  if (!answer || typeof answer !== "object") return { confidence: 0 };
  const value = answer as { type?: unknown; choice?: unknown; confidence?: unknown };
  if (value.type !== "choice" || typeof value.choice !== "string") return { confidence: 0 };
  return {
    ...(value.choice === "__none__" ? {} : { choice: value.choice }),
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
  };
}

function answerNoul(answer: unknown): number {
  if (!answer || typeof answer !== "object") return 0;
  const value = answer as { type?: unknown; noul?: unknown };
  return value.type === "noul" && typeof value.noul === "number" ? value.noul : 0;
}
