import test from 'node:test';
import assert from 'node:assert/strict';
import {isDue} from './tqa-healthcheck-cadence.mjs';
test('five-day cadence has no month-reset or leap-year gap',()=>{
 for(const anchor of ['2026-10-03','2026-12-29','2028-02-26']){
  const start=Date.parse(`${anchor}T00:00:00Z`);const due=[];
  for(let day=0;day<370;day++) if(isDue(new Date(start+day*86_400_000),5,anchor)) due.push(day);
  assert.deepEqual(due,Array.from({length:74},(_,i)=>i*5));
 }
});
test('daily cadence uses UTC day boundaries',()=>{
 assert.equal(isDue('2026-10-04T00:00:00Z',1),true);assert.equal(isDue('2026-10-02T23:59:59Z',1),false);assert.equal(isDue('2026-10-08T00:00:00Z',5),true);assert.equal(isDue('2026-10-07T23:59:59Z',5),false);
});
