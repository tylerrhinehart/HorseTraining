// Isolated localhost-only browser acceptance; never attach to an existing profile.
const { chromium } = await import(process.env.TQA_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.env.TQA_CHROME_PATH ? {executablePath:process.env.TQA_CHROME_PATH} : {})});
const evidence=[];const stamp=Date.now();
try{
for(const [size,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,timezoneId:'America/Boise'});const page=await context.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4174/');await page.getByRole('heading',{name:'In training',exact:true}).waitFor();
 await page.getByRole('button',{name:'Test trainer B'}).click();await page.getByRole('heading',{name:'No horses in training'}).waitFor();
 await page.getByRole('link',{name:'View all horses'}).click();await page.getByRole('heading',{name:'No horses yet'}).waitFor();
 evidence.push(`${size}: empty account onboarding distinguishes empty training list and roster`);
 await page.getByRole('button',{name:'Test trainer A'}).click();await page.getByRole('heading',{name:'Horses',exact:true}).waitFor();
 for(const program of ['foundation','foundation_to_finish','sale_horse']){
  await page.getByRole('link',{name:'+ New horse',exact:true}).click(); await page.getByRole('button',{name:'Add horse',exact:true}).click();
  await page.getByText('Name is required',{exact:true}).waitFor();
  console.log('RUN',size,program);
  const name=`UX ${size} ${program} ${stamp}`;
  await page.getByLabel('Horse name *',{exact:true}).fill(name);await page.getByLabel('Owner name *',{exact:true}).fill('Synthetic UX Owner');
  await page.locator(`input[name="training_type"][value="${program}"]`).check();
  await page.getByText('Training goals (optional)',{exact:true}).click();await page.getByLabel('Fence Work',{exact:true}).check();await page.getByLabel('Heading',{exact:true}).check();
  await page.getByText('Dates and payment details (optional)',{exact:true}).click();await page.getByLabel('Departure date',{exact:true}).fill('2026-12-01');
  if(program==='sale_horse'){await page.getByLabel('Estimated rides needed').fill('30');await page.getByLabel('Purchase price').fill('4500');await page.getByLabel('Expected sale date').fill('2026-11-20');}
  else{await page.getByLabel('Payment method').fill('Check');await page.getByLabel('Payment amount').fill('1200');}
  await page.getByRole('button',{name:'Add horse',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();const horseUrl=page.url();
  await page.getByRole('link',{name:`Log a ride for ${name}`,exact:true}).click();await page.getByRole('heading',{name:'Log a ride'}).waitFor();
  await page.getByLabel('Rider',{exact:true}).fill('Wade UX');await page.getByLabel('When',{exact:true}).fill('2026-10-02T17:00');
  await page.getByLabel('Ride notes',{exact:true}).fill('Unsaved UX ride notes');
  const firstGroup=page.locator('.rating[role="group"]').first();await firstGroup.getByRole('button',{name:program==='foundation'?'Rate +2':'Rate 4',exact:true}).click();
  if(program!=='foundation'){await page.getByLabel('Bit (this week)').selectOption('bit_2');await page.getByRole('button',{name:'Fence Work, Phase 2',exact:true}).click();await page.getByRole('button',{name:'Heading, Phase 3',exact:true}).click();}
  await page.getByRole('link',{name:/^Reference$/i}).click();await page.getByRole('dialog',{name:'Leave without saving?'}).waitFor();await page.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await page.getByLabel('Ride notes',{exact:true}).inputValue(),'Unsaved UX ride notes');
  await page.goBack();await page.getByRole('dialog',{name:'Leave without saving?'}).waitFor();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  assert.match(page.url(),/sessions\/new$/);
  const video=page.getByRole('link',{name:/phase reference video for/}).first();assert.equal(await video.getAttribute('target'),'_blank');
  await context.route(/https:\/\/(youtu\.be|www\.youtube\.com)\//,route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>Isolated reference link test</h1>'}));
  const popupWait=page.waitForEvent('popup');await video.click();const popup=await popupWait;await popup.close();assert.equal(await page.getByLabel('Ride notes',{exact:true}).inputValue(),'Unsaved UX ride notes');
  await page.getByRole('button',{name:'Save ride',exact:true}).click();await page.waitForURL(horseUrl);
  await page.getByText(/All ride history \(1\)/).click();const ride=page.locator('a[href^="/sessions/"]').first();await ride.click();await page.getByRole('button',{name:'Edit ride',exact:true}).waitFor();
  assert.equal(await page.locator('.rating[role="group"]').first().getByRole('button').first().isDisabled(),true);
  await page.getByRole('button',{name:'Edit ride',exact:true}).click();assert.equal(await page.getByLabel('Rider',{exact:true}).inputValue(),'Wade UX');
  await page.locator('.rating[role="group"]').first().getByRole('button',{name:program==='foundation'?'Rate +3':'Rate 5',exact:true}).click();
  await page.getByLabel('Rider',{exact:true}).fill('Corrected rider');await page.getByLabel('When',{exact:true}).fill('2026-10-02T16:30');await page.getByLabel('Ride notes',{exact:true}).fill('Corrected ride notes');
  if(program!=='foundation'){assert.equal(await page.getByLabel('Bit',{exact:true}).inputValue(),'bit_2');await page.getByRole('button',{name:'Fence Work, Phase 4',exact:true}).click();}
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Edit ride',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Edit ride',exact:true}).waitFor();
  assert.match(await page.locator('body').innerText(),/Corrected rider/);assert.match(await page.locator('body').innerText(),/Corrected ride notes/);
  if(program!=='foundation'){assert.match(await page.locator('body').innerText(),/Fence Work · Phase 4/);assert.match(await page.locator('body').innerText(),/Heading · Phase 3/);assert.match(await page.locator('body').innerText(),/Bit 2/);}
  assert.equal(await page.locator('.rating[role="group"]').first().getByRole('button',{name:program==='foundation'?'Rate +3':'Rate 5',exact:true}).getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`docs/pilot/ux-${size}-${program}-saved.png`,fullPage:false});
  await page.getByRole('link',{name:'← Back to horse',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();
  await page.getByLabel(`Comments for ${name}`,{exact:true}).fill('Weekly UX check');await page.getByRole('button',{name:'Save weekly comments',exact:true}).click();await page.getByRole('status').filter({hasText:'Weekly comments saved'}).waitFor();
  await page.reload();assert.equal(await page.getByLabel(`Comments for ${name}`,{exact:true}).inputValue(),'Weekly UX check');
  assert.equal(await page.getByRole('link',{name:'View / download report',exact:true}).count(),1);
  await page.locator('summary').filter({hasText:/^Edit details$/}).click();await page.getByLabel('Owner name',{exact:true}).fill('Corrected synthetic owner');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByText('Owner: Corrected synthetic owner',{exact:true}).waitFor();
  await page.getByRole('link',{name:/^Horses$/i}).click();await page.getByRole('searchbox',{name:'Search horses'}).fill('no-match-ux');await page.getByText('No horses match “no-match-ux”.').waitFor();assert.equal(await page.getByRole('heading',{name:'No horses yet',exact:true}).count(),0);await page.getByRole('searchbox',{name:'Search horses'}).fill('');
  evidence.push(`${size}/${program}: add validation, owner/goals/metadata, blank scores, navigation/back discard guard, video-return draft, save/edit/reload rider+date+bit+tasks+rating+notes, weekly comments, independent report, search empty state PASS`);
 }
 await page.getByRole('link',{name:/^Reference$/i}).click();await page.getByRole('tab',{name:'Videos & Resources',exact:true}).waitFor();assert.equal(await page.getByRole('tab').count(),2);assert.equal(await page.getByRole('tab',{name:'Videos & Resources',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('body').evaluate(body=>body.scrollWidth > window.innerWidth),false);
 await page.screenshot({path:`docs/pilot/ux-${size}-reference.png`,fullPage:false});assert.deepEqual(errors,[]);await context.close();
}
console.log(evidence.join('\n'));await fs.writeFile('docs/pilot/ux-browser-evidence.txt',evidence.join('\n')+'\n');
} finally {await browser.close();}
