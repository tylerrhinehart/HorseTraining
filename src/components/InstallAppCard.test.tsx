import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import InstallAppCard from "./InstallAppCard";
import { initPwaInstall } from "../state/pwaInstall";

let stop: (() => void) | undefined;

afterEach(() => {
  cleanup();
  stop?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retains a browser install prompt offered before the install card opens", () => {
  stop = initPwaInstall();
  const prompt = vi.fn().mockResolvedValue({ outcome: "dismissed" });
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);

  const signIn = render(<InstallAppCard hideWhenInstalled />);
  expect(screen.getByRole("button", { name: "Install app" })).toBeVisible();
  signIn.unmount();

  render(<InstallAppCard />);
  fireEvent.click(screen.getByRole("button", { name: "Install app" }));
  expect(prompt).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  expect(screen.getByText(/Open your browser menu/)).toBeVisible();

  act(() => window.dispatchEvent(new Event("appinstalled")));
  expect(screen.getByRole("status")).toHaveTextContent("TQA is installed.");
});

it("shows Safari's Home Screen instructions on iPhone without a browser prompt", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15");
  stop = initPwaInstall();
  render(<InstallAppCard hideWhenInstalled />);
  expect(screen.getByText("Add to Home Screen")).toBeVisible();
  expect(screen.getByText("Open as Web App")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
});

it("recognizes an already installed standalone launch on page load", () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  stop = initPwaInstall();
  const signIn = render(<InstallAppCard hideWhenInstalled />);
  expect(screen.queryByRole("region", { name: "Install TQA" })).not.toBeInTheDocument();
  signIn.unmount();

  render(<InstallAppCard />);
  expect(screen.getByRole("status")).toHaveTextContent("TQA is installed.");
});
