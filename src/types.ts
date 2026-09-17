export type BrowserAction =
  | "click"
  | "fill"
  | "select"
  | "scroll_down"
  | "scroll_up"
  | "back"
  | "wait"
  | "finish"
  | "fail";

export interface SelectOptionDescriptor {
  value: string;
  label: string;
  disabled: boolean;
}

export interface ActionableElement {
  id: string;
  tag: string;
  role: string;
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
  href?: string;
  disabled: boolean;
  options?: SelectOptionDescriptor[];
}

export interface PageState {
  url: string;
  title: string;
  text: string;
  aria: string;
  elements: ActionableElement[];
}

export interface RunInput {
  url: string;
  task: string;
  variables?: Record<string, string>;
  maxSteps?: number;
  allowDangerous?: boolean;
  headless?: boolean;
}

export type RunStatus =
  | "completed"
  | "failed"
  | "blocked"
  | "requires_confirmation"
  | "max_steps";

export interface StepTrace {
  step: number;
  url: string;
  action: BrowserAction;
  target?: string;
  valueSource?: string;
  actionConfidence: number;
  targetConfidence?: number;
  completionProbability: number;
  blockedProbability: number;
  dangerousProbability: number;
  note?: string;
}

export interface RunResult {
  status: RunStatus;
  task: string;
  startUrl: string;
  finalUrl: string;
  finalTitle: string;
  steps: StepTrace[];
  finalText: string;
  message: string;
}

export interface Decision {
  action: BrowserAction;
  actionConfidence: number;
  targetId?: string;
  targetConfidence?: number;
  valueCandidateId?: string;
  valueConfidence?: number;
  selectOptionKey?: string;
  selectOptionConfidence?: number;
  completionProbability: number;
  blockedProbability: number;
  dangerousProbability: number;
}

export interface ValueCandidate {
  id: string;
  description: string;
  value: string;
  secret: boolean;
}
