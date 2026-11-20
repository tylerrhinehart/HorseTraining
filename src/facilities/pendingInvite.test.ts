import { afterEach, describe, expect, it, vi } from "vitest";
import { captureInviteFragment, clearPendingInvite, inviteLink, pendingInvite } from "./pendingInvite";

const token="a".repeat(64);
afterEach(()=>{
  vi.useRealTimers();
  clearPendingInvite();
  history.replaceState(null,"","/");
});

describe("pending facility invitation", ()=>{
 it("generates a fragment-only link and replaces the browser URL on capture",()=>{
  const url=new URL(inviteLink(token));
  expect(url.pathname).toMatch(/\/facilities$/);
  expect(url.search).toBe("");
  expect(url.hash).toBe("#invite="+token);
  history.replaceState({fixture:true},"",url.pathname+url.hash);
  captureInviteFragment();
  expect(location.hash).toBe("");
  expect(history.state).toEqual({fixture:true});
  expect(pendingInvite()).toBe(token);
  clearPendingInvite();
  expect(pendingInvite()).toBe("");
  expect(sessionStorage.getItem("tqa.pendingInvite")).toBeNull();
 });
 it("expires same-tab state",()=>{
  vi.useFakeTimers();
  history.replaceState(null,"","/facilities#invite="+token);
  captureInviteFragment();
  vi.advanceTimersByTime(31*60*1000);
  expect(pendingInvite()).toBe("");
  expect(sessionStorage.getItem("tqa.pendingInvite")).toBeNull();
 });
 it("leaves auth callbacks alone and strips malformed invite fragments without storing them",()=>{
  history.replaceState(null,"","/#access_token=example&type=signup");
  captureInviteFragment();
  expect(location.hash).toContain("access_token");
  expect(pendingInvite()).toBe("");
  history.replaceState(null,"","/facilities#invite=invalid");
  captureInviteFragment();
  expect(location.hash).toBe("");
  expect(pendingInvite()).toBe("");
 });
});
