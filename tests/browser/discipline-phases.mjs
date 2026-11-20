// Runs against the local synthetic-auth fixture.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.TQA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.TQA_CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(10000);

try {
  for (const program of ["foundation", "foundation_to_finish", "sale_horse"]) {
    const name = `Phase practice · ${program} · ${Date.now()}`;
    await page.goto("http://127.0.0.1:4174/horses/new");
    await page.getByLabel("Horse name *", { exact: true }).fill(name);
    await page.getByLabel("Owner name *", { exact: true }).fill("Practice owner");
    await page.locator(`input[value="${program}"]`).check();
    await page.getByRole("button", { name: "Add horse", exact: true }).click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    const url = page.url();
    const log = page.getByRole("link", { name: `Log a ride for ${name}` });
    if (program === "foundation") {
      await page.getByText("Current foundation phase: Groundwork").waitFor();
      await page.getByRole("button", { name: "Advance to Phase 1", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Advance to Phase 1" }).click();
      await page.getByText("Current foundation phase: Phase 1").waitFor();
      await log.click();
      await page.locator(".field").filter({hasText: "Current foundation phase"}).getByText("Phase 1", {exact:true}).waitFor();
      assert.equal(await page.getByRole("heading", { name: "Task completion" }).count(), 0);
      continue;
    }

    await log.click();
    const headingRow = page.locator(".task-row").filter({has: page.getByText("Heading", {exact: true})});
    await headingRow.getByText("Last worked: No rides logged").waitFor();
    await page.getByLabel("When", {exact:true}).fill("2026-10-07T12:00");
    await page.getByRole("button", { name: "Heading, Phase 2", exact:true }).click();
    await page.getByRole("button", { name: "Fence Work, Phase 1", exact:true }).click();
    await page.getByRole("button", { name: "Save ride", exact: true }).click();
    await page.waitForURL(url);
    const history = page.getByRole("region", {name: "Last phase worked by discipline"});
    const heading = history.locator("dl > div").filter({hasText: "Heading"});
    await heading.getByText("Phase 2 · Wed, Oct 7, 2026", {exact:true}).waitFor();
    await history.getByText("Phase 1 · Wed, Oct 7, 2026", {exact:true}).waitFor();

    await log.click();
    await headingRow.getByText("Last worked: Phase 2 · Wed, Oct 7, 2026").waitFor();
    assert.equal(await headingRow.locator('[aria-pressed="true"]').count(), 0);
    await page.getByLabel("When", {exact:true}).fill("2026-10-05T12:00");
    await page.getByRole("button", { name: "Heading, Phase 3", exact:true }).click();
    await headingRow.getByText("Phase for this ride: Phase 3").waitFor();
    await page.getByRole("button", { name: "Save ride", exact:true }).click();
    await page.waitForURL(url);
    await page.reload();
    await heading.getByText("Phase 2 · Wed, Oct 7, 2026", {exact:true}).waitFor();
    console.log("Verified discipline history and ride selection for", program);
  }
} finally {
  await browser.close();
}
