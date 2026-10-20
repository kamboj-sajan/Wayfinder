/**
 * Login support. With WAYFINDER_LOGIN_USERNAME / WAYFINDER_LOGIN_PASSWORD set,
 * the agent fills matching fields with them and submits before exploring the
 * rest of the page, so a run can get past a login screen.
 *
 * Actions carry only `{ credential: "username" | "password" }`. The secret is
 * read from the environment at fill time, so it never reaches step records,
 * the knowledge base, or the dashboard.
 */

export type CredentialKind = "username" | "password";

const SUBMIT_PATTERN = /^button_.*(log_?in|sign_?in|submit|continue)/;

export function credentialValue(kind: unknown): string | undefined {
  if (kind === "password") return process.env.WAYFINDER_LOGIN_PASSWORD || undefined;
  if (kind === "username") return process.env.WAYFINDER_LOGIN_USERNAME || undefined;
  return undefined;
}

/** Which credential belongs in this input action, if any is configured. */
export function credentialKind(actionId: string): CredentialKind | null {
  if (!actionId.startsWith("input_")) return null;

  if (actionId.includes("pass")) {
    return credentialValue("password") ? "password" : null;
  }

  if (/user|e_?mail|login/.test(actionId)) {
    return credentialValue("username") ? "username" : null;
  }

  return null;
}

/**
 * The next login step among the untried actions in a state: an empty
 * credential field first, then (once one has been filled here) a submit button.
 */
export function nextLoginAction(untried: string[], triedHere: Set<string>): string | undefined {
  const field = untried.find((id) => credentialKind(id) !== null);
  if (field) return field;

  const filledCredential = Array.from(triedHere).some((id) => credentialKind(id) !== null);
  if (filledCredential) return untried.find((id) => SUBMIT_PATTERN.test(id));

  return undefined;
}
