// Runs only against the local synthetic-auth fixture.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.TQA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.TQA_CHROME_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(10000);
try {
  const name = `Juniper · practice ${Date.now()}`;
  await page.goto("http://127.0.0.1:4174/horses/new");
  await page.getByLabel("Horse name *", {exact: true}).fill(name);
  await page.getByLabel("Owner name *", {exact: true}).fill("Practice owner");
  await page.locator('input[value="foundation_to_finish"]').check();
  await page.getByText("Training goals (optional)", {exact:true}).click();
  await page.getByLabel("Heading", {exact:true}).check();
  await page.getByLabel("Fence Work", {exact:true}).check();
  await page.getByRole("button", {name:"Add horse", exact:true}).click();
  await page.getByRole("heading", {name, exact:true}).waitFor();
  const horseUrl = page.url();
  await page.getByRole("link", { name: "Start Ride", exact: true }).click();
  const sheet = page.locator("details").filter({ has: page.locator("summary", {hasText:"Performance warm-up"}) });
  assert.equal(await sheet.evaluate(element => element.open), true);
  await sheet.locator('.rating[role="group"]').first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Fence Work, Phase 2" }).textContent(), "Phase 2");
  await page.getByRole("button", {name:"Fence Work, Phase 2", exact:true}).click();
  await page.getByRole("button", {name:"Heading, Phase 3", exact:true}).click();
  assert.equal(await page.getByRole("link",{name:/Fence Work P2/}).getAttribute("href"), "https://youtu.be/YfVmfI5fQwU");
  await page.getByText(/Live cattle: put the rope/).waitFor();
  await page.getByLabel("Ride notes", {exact:true}).fill("Practice ride with two agreed goals.");
  await page.getByRole("button", {name:"Save ride", exact:true}).click();
  await page.waitForURL(horseUrl);
  await page.reload();
  await page.getByText("All ride history (1)", {exact:true}).click();
  const scoredCount = page.locator(".ride-stats div").filter({ hasText: "Scored rides" }).locator("dd");
  assert.equal(await scoredCount.textContent(), "0");
  await page.getByRole("link",{name:"Add scores", exact:true}).click();
  await page.locator('.rating[role="group"]').first().getByRole("button",{name:"Rate 4",exact:true}).click();
  await page.getByRole("button",{name:"Save changes",exact:true}).click();
  await page.getByRole("button",{name:"Edit ride",exact:true}).waitFor();
  await page.goto(horseUrl);
  await page.getByText("All ride history (1)", {exact:true}).click();
  assert.equal(await scoredCount.textContent(), "1");
  assert.equal(await page.locator(".ride-stats div").filter({ hasText: "Current program average" }).locator("dd").textContent(), "4.0");
  await page.getByRole("link", { name: `Log a ride for ${name}` }).click();
  await page.getByRole("button", { name: "Fence Work, Phase 1", exact: true }).click();
  await page.getByLabel("Ride notes", { exact: true }).fill("Practice ride ready for you to score.");
  await page.getByRole("button", { name: "Save ride", exact: true }).click();
  await page.waitForURL(horseUrl);
  await page.getByText("All ride history (2)", { exact: true }).click();
  await page.getByRole("link", { name: "Add scores", exact: true }).waitFor();
  assert.equal(await scoredCount.textContent(), "1");
  assert.equal(await page.locator(".ride-stats div").filter({ hasText: "Current program average" }).locator("dd").textContent(), "4.0");
  await page.goto(horseUrl + "/finish?step=1");
  const assessment = page.getByLabel("Trainer assessment · Fence Work");
  await assessment.fill("Stayed with the cow through the turn.");
  await page.getByRole("button",{name:"Save goal assessments"}).click();
  await page.getByText("Goal assessments saved.").waitFor();
  await page.reload();
  await assessment.waitFor();
  assert.equal(await assessment.inputValue(),"Stayed with the cow through the turn.");
  await page.getByText(/Phases worked: 3 · 1 supporting ride/).waitFor();
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("link",{name:/Preview saved owner report/}).click();
  const report = await popupEvent;
  const downloadEvent = report.waitForEvent("download",{timeout:30000});
  await report.getByRole("link",{name:"Download PDF",exact:true}).click();
  const download = await downloadEvent;
  assert.equal(await download.failure(), null);
  if (process.env.TQA_TEST_PDF) await download.saveAs(process.env.TQA_TEST_PDF);
  console.log("Verified unscored save, later scoring, resources, assessments and PDF at", horseUrl);
} finally {
  await browser.close();
}
