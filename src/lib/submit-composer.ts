export function submitHostComposer(root: ParentNode | null): void {
  const form = root?.querySelector<HTMLFormElement>("form[data-promptbox]");
  if (!form) return;
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
}
