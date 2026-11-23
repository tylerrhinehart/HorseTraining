import { useCallback, useEffect, useRef, useState } from "react";
import { openVoiceCapture, type VoiceCapture } from "./voiceCapture";

type Connection =
  | { state: "off" | "starting" | "unavailable"; capture?: undefined }
  | { state: "on"; capture: VoiceCapture };

export function useVoiceCall() {
  const [connection, setConnection] = useState<Connection>({ state: "off" });
  const active = useRef<AbortController>();
  const connected = useRef(false);
  const resumeOnReturn = useRef(false);

  const stop = useCallback((request = active.current) => {
    if (request && active.current !== request) return;
    resumeOnReturn.current = false;
    if (!request) return;
    active.current = undefined;
    connected.current = false;
    request.abort();
    setConnection({ state: "off" });
  }, []);

  const start = useCallback(() => {
    if (active.current || document.hidden) return active.current;
    const request = new AbortController();
    active.current = request;
    setConnection({ state: "starting" });
    const unavailable = () => {
      if (active.current !== request) return;
      active.current = undefined;
      connected.current = false;
      request.abort();
      setConnection({ state: "unavailable" });
    };
    // Start permission and AudioContext in the click that enters the call.
    void openVoiceCapture(request.signal, unavailable).then(capture => {
      if (active.current === request && !document.hidden) {
        connected.current = true;
        setConnection({ state: "on", capture });
      } else capture.close();
    }, unavailable);
    return request;
  }, []);

  useEffect(() => {
    const background = () => {
      if (document.hidden) {
        const shouldResume = connected.current;
        stop();
        resumeOnReturn.current = shouldResume;
      } else if (resumeOnReturn.current) {
        resumeOnReturn.current = false;
        start();
      }
    };
    const hide = () => stop();
    document.addEventListener("visibilitychange", background);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", background);
      window.removeEventListener("pagehide", hide);
      const request = active.current;
      active.current = undefined;
      connected.current = false;
      resumeOnReturn.current = false;
      request?.abort();
    };
  }, [start, stop]);

  return { ...connection, start, stop };
}

export type VoiceCall = ReturnType<typeof useVoiceCall>;
