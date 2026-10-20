import { Page } from "playwright";

export async function waitForPageStability(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");

  // extra SPA hydration buffer
  await page.waitForTimeout(2000);

  // avoid screenshots during "Loading..."
  await page.waitForFunction(() => {
    const txt = document.body.innerText.toLowerCase();
    return !txt.includes("loading");
  }, { timeout: 5000 }).catch(() => {});
}
