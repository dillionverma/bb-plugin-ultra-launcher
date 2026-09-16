import { describe, expect, it, vi } from "vitest";
import { submitHostComposer } from "./submit-composer";

describe("submitHostComposer", () => {
  it("submits the host form so compact viewports work too", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div><form data-promptbox=""><div contenteditable="true"></div><button type="submit">go</button></form></div>`;
    document.body.appendChild(root);
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    root.querySelector("form")!.addEventListener("submit", onSubmit);

    expect(submitHostComposer(root)).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    root.remove();
  });

  it("falls back to an Enter keydown when there is no form", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div contenteditable="true"></div>`;
    document.body.appendChild(root);
    const onKeyDown = vi.fn();
    root.addEventListener("keydown", onKeyDown);

    expect(submitHostComposer(root)).toBe(true);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect((onKeyDown.mock.calls[0][0] as KeyboardEvent).key).toBe("Enter");
    root.remove();
  });

  it("reports when nothing submittable is mounted", () => {
    expect(submitHostComposer(null)).toBe(false);
    expect(submitHostComposer(document.createElement("div"))).toBe(false);
  });
});
