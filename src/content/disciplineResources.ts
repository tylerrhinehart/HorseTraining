// Training Quality Assurance, Foundation to Finish industry standards.
// Phase-specific videos are listed separately from discipline-wide materials.
export const PERFORMANCE_STANDARDS = "https://trainingqualityassurance.org/industry-standards-2/";
const uploads = "https://trainingqualityassurance.org/wp-content/uploads/2022/";

interface DisciplineMaterial {
  sheet: string;
  phaseVideos?: Record<number, string[]>;
  disciplineVideo?: string;
  descriptions?: string[];
}

const ropeSheet = uploads + "02/TQA-Rope-Horse-Prospect-Judges-Sheet.pptx";
const calfRoping: DisciplineMaterial = {
  sheet: ropeSheet,
  disciplineVideo: "kQsE8z9Yf7A",
  descriptions: ["Roping dummy at a walk or slow trot", "Roping dummy at a slow trot or lope", "Slow calves (dairy cows)", "Rodeo run"],
};

export const DISCIPLINE_MATERIALS: Partial<Record<string, DisciplineMaterial>> = {
  reining: {
    sheet: uploads + "05/TQA-Reining-Phases.pptx",
    phaseVideos: { 1: ["YanT9n_aGYY"], 2: ["N4vLQBvmXwA"], 3: ["TgPlcePBDhc"], 4: ["S3s8GFy8RaM"] },
  },
  fence_work: {
    sheet: uploads + "02/TQA-Fence-Work-11-5.pptx",
    phaseVideos: { 1: ["_ma0U5dFtUQ"], 2: ["YfVmfI5fQwU"] },
  },
  feed_lot: {
    sheet: uploads + "02/TQA-Feed-Lot-Phase-1-to-Phase-4.pptx",
    phaseVideos: { 1: ["WeVZmZI_rLM"], 2: ["ofjk_Jmu7CI"] },
  },
  ranch_roping: {
    sheet: uploads + "02/TQA-Team-Branding-Score-Sheets-2019-2020.xlsx",
    phaseVideos: { 1: ["uXKki55E9R0", "BOXbq_gl7lY"], 2: ["MRnpx3SBxO0", "G6mhGo3HALs"], 3: ["je6fmkFpMuM"] },
  },
  heading: {
    sheet: ropeSheet,
    disciplineVideo: "sdwsQ2JZKH0",
    descriptions: ["Roping dummy at a walk or slow trot", "Roping dummy at a slow trot or lope", "Live cattle: put the rope on in the chute and steer stop", "Live cattle: rodeo run"],
  },
  heeling: {
    sheet: ropeSheet,
    disciplineVideo: "aStn7qgPTMM",
    descriptions: ["Roping dummy at a walk or slow trot", "Roping dummy at a slow trot or lope", "Live cattle: push around the header once, then rope", "Rodeo run"],
  },
  breakaway: calfRoping,
  calf_roping: calfRoping,
};
