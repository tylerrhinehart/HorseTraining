// Foundation-for-Perfection doctrine + the public Foundation page's
// "Colt Starting & Foundation Tune-Ups" reference content. This is rendered
// on the in-app /foundation page so trainers can show clients the same
// framework that the website publishes.

export interface DoctrineSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export const FFP_SECTIONS: DoctrineSection[] = [
  {
    heading: "The Training Trifecta",
    body: [
      "Every trainer evaluation answers three questions at once: Foundation, Task Completion, and Temperament. A horse may complete a task without a solid foundation, or have a willing temperament but lack the foundation to perform safely under pressure. All three axes must be assessed.",
    ],
    bullets: [
      "Foundation — the underlying movements (lope a circle, stop with both reins, lateral motion, vertical flexion).",
      "Task Completion — the practical jobs (catch, saddle, tie, load, discipline-specific tasks).",
      "Temperament — the driving factors (energy, self-preservation, confidence, sensitivity, reaction to social separation).",
    ],
  },
  {
    heading: "3 Causes of Resistance",
    body: [
      "When a horse resists, the cause is one of three things: confusion, fear, or disrespect. The fix changes depending on which one is at play.",
    ],
    bullets: [
      "Confusion — the horse does not understand the request.",
      "Fear — the horse perceives danger in the request.",
      "Disrespect — the horse understands and is not afraid, but chooses not to comply.",
    ],
  },
  {
    heading: "5 Driving Factors of Temperament",
    body: [
      "These five (six on the per-phase score sheets, with Willingness added) describe the horse's nature and how it will respond to training pressure.",
    ],
    bullets: [
      "Self-preservation (fight or flight)",
      "Confidence",
      "Energy (motivation and determination)",
      "Sensitivity (response to light pressure)",
      "Reaction to social separation",
    ],
  },
  {
    heading: "4 Stages of Pressure",
    body: [
      "Pressure is applied progressively. Start at Stage 1 and only escalate as needed; release the moment the horse offers the correct answer.",
    ],
    bullets: [
      "Stage 1 — suggestion (rein, leg, voice).",
      "Stage 2 — light reinforcement.",
      "Stage 3 — firm reinforcement.",
      "Stage 4 — strong correction.",
    ],
  },
  {
    heading: "Horizontal & Vertical Direction",
    body: [
      "Horizontal Direction (HD) drives the horse's feet across the ground. Vertical Direction (VD) collects the horse from the poll through the spine. A finished horse moves between HD and VD on cue.",
    ],
  },
];

// Public Foundation page: the four framework questions a client should ask
// when hiring a professional trainer.
export interface FrameworkQuestion {
  number: number;
  question: string;
  summary: string;
}

export const FRAMEWORK_QUESTIONS: FrameworkQuestion[] = [
  {
    number: 1,
    question: "How much should I expect to pay a professional horse trainer?",
    summary:
      "Price varies depending on feed and board, as well as the type and level of professional horse trainer.",
  },
  {
    number: 2,
    question: "How many rides should I expect my horse to get for two months?",
    summary:
      "TQA publishes three recommended cadences for setting a foundation on a horse — see the ride options below.",
  },
  {
    number: 3,
    question:
      'What should I expect my horse to be able to do at the end of 2 months from a "professional horse training"?',
    summary:
      "A 15-item industry checklist of behaviors the horse should perform — see the Training Trifecta below.",
  },
  {
    number: 4,
    question: "What should I expect from the trainer at the end of the 2 months?",
    summary:
      "Five trainer expectations: ride the horse for the client (or provide video), give a Training Trifecta evaluation, ideally give the client riding lessons, walk the client through the full process, and discuss owner expectations on pickup.",
  },
];

export const TRAINER_EXPECTATIONS: string[] = [
  "Ride the horse for the client, or provide a video demonstrating the horse's current level of training and progress.",
  'Give a "Training Trifecta" evaluation: Foundation, Task Completions & Temperament.',
  "Ideally ride with client and give riding lessons if client is interested.",
  "Make sure client is familiar with the entire horse training process and where the horse is in the process.",
  "Discuss horse owner expectations when the horse is taken home and discuss further training/lessons if necessary.",
];
