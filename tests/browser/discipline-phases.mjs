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
    const log = page.getByRole("link", { name: "Start Ride" });
    if (program === "foundation") {
      await page.getByRole("heading",{ name:"Groundwork", exact:true }).waitFor();
      await page.getByRole("button", { name: /Review Phase 1/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Advance to Phase 1" }).click();
      await page.getByRole("heading",{ name:"Phase 1", exact:true }).waitFor();
      await page.getByRole("button",{name:"Undo advance"}).click();
      await page.getByRole("dialog").getByRole("button",{name:"Return to Groundwork"}).click();
      await page.getByRole("heading",{name:"Groundwork",exact:true}).waitFor();
      await page.getByRole("button",{name:/Review Phase 1/}).click();
      await page.getByRole("dialog").getByRole("button",{name:"Advance to Phase 1"}).click();
      await page.getByRole("heading",{name:"Phase 1",exact:true}).waitFor();
      await page.getByRole("button",{name:"Add focus"}).click();
      await page.getByLabel("Focus for next ride").fill("Review standing to saddle.");
      await page.getByRole("button",{name:"Save focus"}).click();
      await page.getByText("Review standing to saddle.", {exact:true}).waitFor();
      await page.reload();
      await page.getByText("Review standing to saddle.", {exact:true}).waitFor();
      console.log("Foundation practice workspace", url);
      await log.click();
      await page.evaluate(() => localStorage.removeItem("tqa.activeHorseId"));
      await page.reload();
      await page.locator("header.topbar").getByText(name, {exact:true}).waitFor();
      await page.getByText("Review standing to saddle.", {exact:true}).waitFor();
      await page.locator(".field").filter({hasText: "Current foundation phase"}).getByText("Phase 1", {exact:true}).waitFor();
      assert.equal(await page.getByRole("heading", { name: "Task completion" }).count(), 0);
      continue;
    }

    await log.click();
    const headingRow = page.locator(".task-row").filter({has: page.getByText("Heading", {exact: true})});
    await headingRow.getByText("Last worked: No rides logged").waitFor();
    await headingRow.getByRole("button",{name:"Phase guide for Heading"}).click();
    await page.getByRole("dialog").getByText(/steer stop/i).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('.task-phases [aria-pressed="true"]').count(),0);
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
