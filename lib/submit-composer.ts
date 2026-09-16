// Ask the host's embedded composer to submit itself.
//
// The composer owns its submit button, its Enter handling and its
// "can submit" guard, so the dialog never calls onSubmit directly. Earlier
// versions faked an Enter keydown on the editor. That only works on regular
// viewports: on a compact (phone) viewport the host deliberately treats Enter
// as a newline and reserves submission for its send button, so the faked key
// did nothing and "Create" was dead on mobile. Submitting the form itself goes
// through the same host path as its own button on every viewport.
export function submitHostComposer(root: ParentNode | null): boolean {
  if (!root) return false;
  const form =
    root.querySelector<HTMLFormElement>("form[data-promptbox]") ??
    root.querySelector<HTMLFormElement>("form");
  if (form) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    }
    return true;
  }
  // Older host builds without a form: fall back to the keyboard path.
  const editor = root.querySelector<HTMLElement>(
    '[contenteditable="true"], textarea',
  );
  if (!editor) return false;
  editor.focus();
  editor.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  return true;
}
