// Optional API smoke against the disposable PostgREST fixture only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const a = "00000000-0000-0000-0000-000000000001";
const b = "00000000-0000-0000-0000-000000000002";
let actor = a;
const client = createClient("http://127.0.0.1:56434", "local-fixture-only", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => fetch(input, {
      ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), "x-tqa-test-user": actor },
    }),
  },
});
async function ok(call) {
  const { data, error } = await call;
  assert.equal(error, null, JSON.stringify(error));
  return data;
}

const memberships = await ok(client.from("facility_memberships")
  .select("facility_id,user_id,role,facility:facilities(*)").eq("user_id", a));
assert.equal(memberships.length, 1);
const facility = memberships[0].facility;
assert.equal(facility.name, "Fixture Facility A");
const { id: horse } = await ok(client.from("horses").select("id")
  .eq("facility_id", facility.id).eq("name", "Foundation Colt").single());
const { id: phase } = await ok(client.from("phases").select("id")
  .eq("facility_id", facility.id).eq("code", "phase_1").single());
const item = (await ok(client.from("questions").select("id,text,axis").eq("phase_id", phase).limit(1)))[0];
const { id: draft, version } = await ok(client.rpc("create_ride_draft", {
  p_facility_id: facility.id, p_horse_id: horse, p_phase_id: phase, p_request_id: randomUUID(),
}));

actor = b;
assert.deepEqual(await ok(client.from("horses").select("id").eq("id", horse)), []);
const denied = await client.rpc("get_ride_draft", { p_draft_id: draft });
assert.ok(denied.error, "another tenant must not be able to open the draft");
actor = a;

const rated = await ok(client.rpc("save_ride_draft", {
  p_draft_id: draft, p_expected_version: version, p_request_id: randomUUID(),
  p_notes: "Synthetic API test", p_stage_notes: {}, p_ratings: [{ question_id: item.id, score: -2 }],
  p_occurred_at: "2026-11-20T10:00:00Z", p_rider: null, p_bit: null, p_task_completions: [],
}));
const reloaded = await ok(client.rpc("get_ride_draft", { p_draft_id: draft }));
assert.equal(reloaded.ratings[0].score, -2);
assert.equal(reloaded.version, rated.version);
const args = { p_draft_id: draft, p_expected_version: rated.version, p_request_id: randomUUID() };
const finalized = await ok(client.rpc("finalize_ride_draft", args));
assert.equal((await ok(client.rpc("finalize_ride_draft", args))).session_id, finalized.session_id);
const ride = await ok(client.from("sessions").select("id,facility_id,horse_id,notes,ratings(*)")
  .eq("id", finalized.session_id).single());
assert.equal(ride.facility_id, facility.id);
assert.equal(ride.horse_id, horse);
assert.equal(ride.ratings.length, 1);
assert.equal(ride.ratings[0].score, -2);
assert.equal(ride.ratings[0].question_text_snapshot, item.text);
assert.equal(ride.notes, "Synthetic API test");
console.log("PASS: actual PostgREST tenant/relationship queries, draft re-open, finalization and persisted signed score.");
