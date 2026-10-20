import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decisionEngine } from "../langraph/nodes/decisionEngine.js";
import { credentialKind, credentialValue } from "../langraph/utils/login.js";
import type { AgentState } from "../shared/types.js";

const LOGIN_PAGE = ["link_about", "button_sign_in", "input_username", "input_password", "input_first_name"];

function loginState(triedActions: string[] = []): AgentState {
  return {
    schema_version: "1.0",
    run_id: "test-run",
    runtime: { url: "https://example.com", browser: "chromium", timestamp: "" },
    ui_state: {
      state_id: "login",
      route: "/",
      title: "Login",
      available_actions: LOGIN_PAGE,
      entities: { url: "https://example.com/" }
    },
    steps: triedActions.map((id, i) => ({
      step: i,
      action: { action_id: id, parameters: {} },
      observation: { actionId: id, networkCalls: [], consoleErrors: [] },
      state_id: "login"
    }))
  };
}

describe("login support", () => {
  beforeEach(() => {
    process.env.WAYFINDER_LOGIN_USERNAME = "standard_user";
    process.env.WAYFINDER_LOGIN_PASSWORD = "s3cret-value";
  });

  afterEach(() => {
    delete process.env.WAYFINDER_LOGIN_USERNAME;
    delete process.env.WAYFINDER_LOGIN_PASSWORD;
  });

  it("fills credential fields before anything else on the page", () => {
    expect(decisionEngine(loginState()).next_action?.action_id).toBe("input_username");
    expect(decisionEngine(loginState(["input_username"])).next_action?.action_id).toBe("input_password");
  });

  it("submits once the credentials are filled", () => {
    const out = decisionEngine(loginState(["input_username", "input_password"]));
    expect(out.next_action?.action_id).toBe("button_sign_in");
  });

  it("never puts the secret itself into the action", () => {
    const out = decisionEngine(loginState(["input_username"]));
    expect(out.next_action?.parameters).toEqual({ credential: "password" });
    expect(JSON.stringify(out)).not.toContain("s3cret-value");
  });

  it("resolves credentials at fill time", () => {
    expect(credentialValue("username")).toBe("standard_user");
    expect(credentialValue("password")).toBe("s3cret-value");
    expect(credentialValue("value")).toBeUndefined();
  });

  it("matches login fields but not other inputs or buttons", () => {
    expect(credentialKind("input_email")).toBe("username");
    expect(credentialKind("input_user_name")).toBe("username");
    expect(credentialKind("input_first_name")).toBeNull();
    expect(credentialKind("button_login")).toBeNull();
  });

  it("explores normally when no credentials are configured", () => {
    delete process.env.WAYFINDER_LOGIN_USERNAME;
    delete process.env.WAYFINDER_LOGIN_PASSWORD;

    const out = decisionEngine(loginState());
    expect(out.next_action?.action_id).toBe("link_about");
    expect(credentialKind("input_password")).toBeNull();
  });
});
