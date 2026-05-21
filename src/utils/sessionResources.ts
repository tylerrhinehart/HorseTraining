import type { ID, Question, Resource } from "../supabase/types";

export interface SessionResourceGroup {
  question: Question;
  resources: Resource[];
}

export interface SessionResourcePlan {
  phaseResources: Resource[];
  questionGroups: SessionResourceGroup[];
  videoCount: number;
  linkCount: number;
  totalCount: number;
}

export function organizeSessionResources(input: {
  questions: Question[];
  phaseResources: Resource[];
  resourcesByQuestionId: Record<ID, Resource[]>;
}): SessionResourcePlan {
  const phaseResources = [...input.phaseResources].sort(byPositionThenTitle);
  const questionGroups = [...input.questions]
    .sort((a, b) => a.position - b.position)
    .map((question) => ({
      question,
      resources: [...(input.resourcesByQuestionId[question.id] ?? [])].sort(
        byPositionThenTitle,
      ),
    }))
    .filter((group) => group.resources.length > 0);

  const allResources = [
    ...phaseResources,
    ...questionGroups.flatMap((group) => group.resources),
  ];

  return {
    phaseResources,
    questionGroups,
    videoCount: allResources.filter((resource) => resource.kind === "youtube")
      .length,
    linkCount: allResources.filter((resource) => resource.kind === "link").length,
    totalCount: allResources.length,
  };
}

function byPositionThenTitle(a: Resource, b: Resource) {
  return a.position - b.position || a.title.localeCompare(b.title);
}
