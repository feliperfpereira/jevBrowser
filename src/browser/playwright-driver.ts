import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import type { ActionableElement, PageState } from "../types.js";
import type { AgentConfig } from "../config.js";

const ELEMENT_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='tab']",
  "[role='menuitem']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export class PlaywrightDriver {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private page: Page | undefined;

  constructor(private readonly config: AgentConfig) {}

  async start(url: string): Promise<void> {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }

    this.browser = await chromium.launch({ headless: this.config.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1365, height: 900 },
    });
    this.context.setDefaultTimeout(this.config.actionTimeoutMs);
    this.page = await this.context.newPage();
    await this.page.goto(parsed.toString(), {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs,
    });
    await this.settle();
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
    this.context = undefined;
    this.page = undefined;
  }

  async observe(): Promise<PageState> {
    const page = this.requirePage();
    const [title, text, ariaJson, elements] = await Promise.all([
      page.title(),
      page.locator("body").innerText({ timeout: this.config.actionTimeoutMs }).catch(() => ""),
      page.ariaSnapshotJSON({ mode: "ai", depth: 8 }).catch(() => null),
      this.collectElements(page),
    ]);

    return {
      url: page.url(),
      title,
      text: text.slice(0, this.config.maxPageTextChars),
      aria: JSON.stringify(ariaJson).slice(0, this.config.maxAriaChars),
      elements,
    };
  }

  async click(id: string): Promise<void> {
    const page = this.requirePage();
    const context = this.requireContext();
    const beforePages = new Set(context.pages());
    const locator = this.locatorFor(id);
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ timeout: this.config.actionTimeoutMs });
    await this.settle();

    const newPage = context.pages().find((candidate) => !beforePages.has(candidate));
    if (newPage) {
      this.page = newPage;
      await newPage
        .waitForLoadState("domcontentloaded", { timeout: this.config.navigationTimeoutMs })
        .catch(() => undefined);
      await this.settle();
    } else if (page.isClosed()) {
      this.page = context.pages().at(-1);
    }
  }

  async fill(id: string, value: string): Promise<void> {
    const locator = this.locatorFor(id);
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value, { timeout: this.config.actionTimeoutMs });
    await this.settle();
  }

  async select(id: string, value: string): Promise<void> {
    const locator = this.locatorFor(id);
    await locator.scrollIntoViewIfNeeded();
    await locator.selectOption({ value }, { timeout: this.config.actionTimeoutMs });
    await this.settle();
  }

  async scroll(direction: "up" | "down"): Promise<void> {
    const page = this.requirePage();
    const delta = Math.max(500, Math.floor((await page.evaluate(() => window.innerHeight)) * 0.8));
    await page.mouse.wheel(0, direction === "down" ? delta : -delta);
    await this.settle();
  }

  async back(): Promise<void> {
    const page = this.requirePage();
    await page
      .goBack({ waitUntil: "domcontentloaded", timeout: this.config.navigationTimeoutMs })
      .catch(() => null);
    await this.settle();
  }

  async wait(): Promise<void> {
    await this.requirePage().waitForTimeout(Math.max(500, this.config.settleMs * 2));
  }

  private locatorFor(id: string): Locator {
    return this.requirePage().locator(`[data-jev-browser-id="${id}"]`).first();
  }

  private async settle(): Promise<void> {
    const page = this.page;
    if (!page || page.isClosed()) return;
    await page.waitForTimeout(this.config.settleMs);
    await page.waitForLoadState("domcontentloaded", { timeout: 2_000 }).catch(() => undefined);
  }

  private async collectElements(page: Page): Promise<ActionableElement[]> {
    return page.locator(ELEMENT_SELECTOR).evaluateAll((nodes, maxElements) => {
      document
        .querySelectorAll("[data-jev-browser-id]")
        .forEach((node) => node.removeAttribute("data-jev-browser-id"));

      function visible(element: Element): boolean {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      }

      function roleFor(element: Element): string {
        const explicit = element.getAttribute("role");
        if (explicit) return explicit;
        const tag = element.tagName.toLowerCase();
        if (tag === "a") return "link";
        if (tag === "button") return "button";
        if (tag === "select") return "combobox";
        if (tag === "textarea") return "textbox";
        if (tag === "input") {
          const type = (element.getAttribute("type") ?? "text").toLowerCase();
          if (type === "checkbox") return "checkbox";
          if (type === "radio") return "radio";
          if (["button", "submit", "reset"].includes(type)) return "button";
          return "textbox";
        }
        return tag;
      }

      function labelFor(element: Element): string {
        const html = element as HTMLElement;
        const aria = element.getAttribute("aria-label")?.trim();
        if (aria) return aria;
        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ");
          if (text) return text;
        }
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          const labels = Array.from(element.labels ?? [])
            .map((label) => label.textContent?.trim() ?? "")
            .filter(Boolean);
          if (labels.length) return labels.join(" ");
          const placeholder = element.getAttribute("placeholder")?.trim();
          if (placeholder) return placeholder;
          const name = element.getAttribute("name")?.trim();
          if (name) return name;
        }
        const title = element.getAttribute("title")?.trim();
        if (title) return title;
        const text = html.innerText?.replace(/\s+/g, " ").trim();
        if (text) return text.slice(0, 240);
        return (
          element.getAttribute("name")?.trim() ||
          element.getAttribute("id")?.trim() ||
          roleFor(element)
        );
      }

      const output: ActionableElement[] = [];
      for (const element of nodes) {
        if (!(element instanceof HTMLElement) || !visible(element)) continue;
        if (output.length >= maxElements) break;

        const id = `e${output.length + 1}`;
        element.setAttribute("data-jev-browser-id", id);
        const disabled =
          ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) ||
          element.getAttribute("aria-disabled") === "true";

        const descriptor: ActionableElement = {
          id,
          tag: element.tagName.toLowerCase(),
          role: roleFor(element),
          name: labelFor(element),
          disabled,
        };

        const type = element.getAttribute("type");
        const placeholder = element.getAttribute("placeholder");
        if (type) descriptor.type = type;
        if (placeholder) descriptor.placeholder = placeholder.slice(0, 160);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          if (element.type !== "password" && element.value) {
            descriptor.value = element.value.slice(0, 240);
          }
        }
        if (element instanceof HTMLAnchorElement && element.href) descriptor.href = element.href;
        if (element instanceof HTMLSelectElement) {
          descriptor.options = Array.from(element.options)
            .filter((option) => !option.hidden)
            .slice(0, 40)
            .map((option) => ({
              value: option.value,
              label: option.label || option.text,
              disabled: option.disabled,
            }));
        }
        output.push(descriptor);
      }
      return output;
    }, this.config.maxElements);
  }

  private requirePage(): Page {
    if (!this.page) throw new Error("Browser is not started");
    return this.page;
  }

  private requireContext(): BrowserContext {
    if (!this.context) throw new Error("Browser is not started");
    return this.context;
  }
}
