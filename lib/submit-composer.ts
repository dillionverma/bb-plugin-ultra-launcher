// Submit the host composer's own form rather than faking an Enter keydown:
// on compact viewports the host treats Enter as a newline and reserves
// submission for its send button. The form owns the submit guard and the
// onSubmit call, so every viewport takes the same host path.
export function submitHostComposer(root: ParentNode | null): void {
  const form = root?.querySelector<HTMLFormElement>("form[data-promptbox]");
  if (!form) return;
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
}
