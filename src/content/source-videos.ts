// Supplied in Wade Black's May 24/26 feedback; available without a database seed.
export const SOURCE_VIDEO_GROUPS = [
  { title: "Foundation", videos: [
    { title: "Groundwork", url: "https://youtu.be/QUP5XSe73oo" },
    { title: "Phase 1", url: "https://youtu.be/97rDdcw5SJQ" },
    { title: "Phase 2", url: "https://youtu.be/xvORqrG1BNY" },
    { title: "Phase 3", url: "https://youtu.be/Je5RaMkXZPE" },
    { title: "Phase 4", url: "https://www.youtube.com/watch?v=nFd0WHDvMPk" },
  ] },
  { title: "Foundation to Finish/ Performance Horse", videos: [
    { title: "Introduction", url: "https://www.youtube.com/watch?v=zbydvOW8GDc" },
    { title: "Ground Work", url: "https://www.youtube.com/watch?v=QZA-vBGEM8I" },
    { title: "First Get On", url: "https://youtu.be/rUfXGhW7YD8" },
    { title: "Review of Vocab Words", url: "https://youtu.be/oPILKcCh44Y" },
    { title: "Reining Cow Horse Warm-Up", url: "https://youtu.be/B7lJWXfj4vY" },
  ] },
];

import type { PhaseCode } from "../supabase/types";
export interface SourceVideo { title: string; url: string }
export function phaseReferenceVideo(code: PhaseCode | undefined): SourceVideo | undefined {
  const index = ["groundwork", "phase_1", "phase_2", "phase_3", "phase_4"].indexOf(code ?? "");
  if (index >= 0) return SOURCE_VIDEO_GROUPS[0].videos[index];
  if (code === "performance_warmup") return SOURCE_VIDEO_GROUPS[1].videos[4];
  return undefined;
}
