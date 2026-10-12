import { describe, expect, it, vi } from "vitest";
import { submitHostComposer } from "./submit-composer";

describe("submitHostComposer", () => {
  it("submits the host form so compact viewports work too", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div><form data-promptbox=""><div contenteditable="true"></div><button type="submit">go</button></form></div>`;
    document.body.appendChild(root);
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    root.querySelector("form")!.addEventListener("submit", onSubmit);

    submitHostComposer(root);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    root.remove();
  });

  it("does nothing before the composer mounts", () => {
    expect(() => submitHostComposer(null)).not.toThrow();
    expect(() => submitHostComposer(document.createElement("div"))).not.toThrow();
  });
});
