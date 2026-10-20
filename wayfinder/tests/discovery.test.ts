import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { launchBrowser } from "../runtime-discovery/src/browser.js";
import { discoverActions } from "../runtime-discovery/src/discoverActions.js";
import { diagnoserNode } from "../langraph/nodes/diagnoser.js";

describe("discoverActions", () => {
  // Launched through the agent's own helper so the Page type matches
  // runtime-discovery's Playwright, not the root package's copy.
  let launched: Awaited<ReturnType<typeof launchBrowser>>;

  beforeAll(async () => {
    launched = await launchBrowser(true);
  });

  afterAll(async () => {
    await launched?.browser.close();
  });

  it("skips elements the executor could not interact with", async () => {
    // Regression: a closed side menu's links were discovered, and each one
    // then failed after retries on every page.
    const { page } = launched;
    await page.setContent(`
      <button>Open Menu</button>
      <nav style="visibility:hidden"><a href="/about">About</a></nav>
      <a href="/hidden" style="display:none">Gone</a>
      <button style="opacity:0">Invisible</button>
      <a href="/home">Home</a>
      <input placeholder="Search">
      <input type="submit" value="Login">
    `);

    const ids = (await discoverActions(page)).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["button_open_menu", "link_home", "input_search", "button_login"]));
    expect(ids).not.toContain("link_about");
    expect(ids).not.toContain("link_gone");
    expect(ids).not.toContain("button_invisible");
  });
});

describe("diagnoserNode", () => {
  it("clears the previous diagnosis on a step without anomalies", async () => {
    // Regression: a stale diagnosis made the learner store every later
    // action as a "fix" for an error that had already passed.
    const stale = { anomalies: [], diagnosis: { error_signature: "old_error" } };
    const out = await diagnoserNode(stale);
    expect(out.diagnosis).toBeUndefined();
  });
});
