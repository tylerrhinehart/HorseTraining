import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDatabase} from './tqa-db-healthcheck.mjs';
const env={VITE_SUPABASE_URL:'https://jdoypblyvhrljqiadzgq.supabase.co',VITE_SUPABASE_ANON_KEY:'synthetic-public-key'};
test('uses a bounded read-only request and logs no returned identifiers',async()=>{
 const result=await checkDatabase(env,async(url,options)=>{
  assert.equal(url,`${env.VITE_SUPABASE_URL}/rest/v1/horses?select=id&limit=1`);assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.headers.apikey,env.VITE_SUPABASE_ANON_KEY);return new Response('[]',{status:200});
 });assert.match(result,/read passed/);
});
test('HTTP failures cannot be mistaken for a successful database read',async()=>{
 await assert.rejects(checkDatabase(env,async()=>new Response('private error details',{status:503})),/HTTP 503/);
});
test('unexpected anonymous row visibility fails without exposing record values',async()=>{
 await assert.rejects(checkDatabase(env,async()=>new Response('[{"id":"private-id-never-log"}]',{status:200})),error=>!error.message.includes('private-id-never-log')&&error.message.includes('anonymous row'));
});
test('rejects another project before transmitting the existing key',async()=>{
 let sent=false;await assert.rejects(checkDatabase({...env,VITE_SUPABASE_URL:'https://example.com'},async()=>{sent=true;}),/Configure/);assert.equal(sent,false);
});
