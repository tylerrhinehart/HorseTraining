import { useEffect, useRef, useState } from "react";
import {
  listAllQuestions,
  listPhases,
  listResourcesForPhase,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { fetchQuery } from "../supabase/cache";
import { qk } from "../supabase/keys";
import type { Resource } from "../supabase/types";
import {
  IconLayers,
  IconPlay,
} from "../components/Icons";
import PhasesTab from "./reference/PhasesTab";
import ResourcesTab from "./reference/ResourcesTab";

type TabId = "phases" | "resources";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "resources", label: "Videos & Resources", icon: <IconPlay size={16} /> },
  { id: "phases", label: "Phases & Questions", icon: <IconLayers size={16} /> },
];

// Legacy anchor ids (pre-tabs) → tab ids, so old links keep working.
const LEGACY_ANCHORS: Record<string, TabId> = {
  phases: "phases",
  resources: "resources",
};

function tabFromHash(): TabId {
  const h = window.location.hash.replace("#", "");
  return LEGACY_ANCHORS[h] ?? "resources";
}

export default function Reference() {
  const phases = useQuery(qk.phases(), () => listPhases());
  const questions = useQuery(["questions", "all"], () => listAllQuestions());

  const [allPhaseResources, setAllPhaseResources] = useState<
    Record<string, Resource[]>
  >({});

  // Resources render after phases without blocking them: once phases resolve,
  // pull each phase's resources through the SWR cache (dedupes with any other
  // reader) and stitch them into a per-phase map.
  useEffect(() => {
    if (!phases.data || phases.data.length === 0) return;
    let cancelled = false;
    Promise.all(
      phases.data.map((p) =>
        fetchQuery(qk.resourcesForPhase(p.id), () =>
          listResourcesForPhase(p.id),
        ).then((res) => ({ id: p.id, res })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Resource[]> = {};
        for (const { id, res } of results) map[id] = res;
        setAllPhaseResources(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phases.data]);

  const questionsFor = (phaseId: string) =>
    (questions.data ?? [])
      .filter((q) => q.phase_id === phaseId)
      .sort((a, b) => a.position - b.position);

  const resourcesFor = (phaseId: string) => allPhaseResources[phaseId] ?? [];

  const [tab, setTab] = useState<TabId>(() => tabFromHash());
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectTab = (id: TabId) => {
    setTab(id);
    // Keep the URL shareable without adding history entries per tab switch.
    window.history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };

  // Back/forward and external #links into the page.
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = TABS.findIndex((t) => t.id === tab);
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? TABS[(idx + 1) % TABS.length]
        : TABS[(idx - 1 + TABS.length) % TABS.length];
    selectTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div className="view" style={{ maxWidth: 860 }}>
      <div className="eyebrow">TQA Reference</div>
      <h1 className="h-display">Reference</h1>

      <div
        className="ref-tabs"
        role="tablist"
        aria-label="Reference sections"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`ref-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ref-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`ref-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id={`ref-panel-${tab}`}
        aria-labelledby={`ref-tab-${tab}`}
      >
        {tab === "phases" && (
          <PhasesTab
            phases={phases.data ?? []}
            questionsFor={questionsFor}
            resourcesFor={resourcesFor}
            loading={phases.loading}
            error={phases.error ?? null}
            onRetry={phases.refresh}
          />
        )}
        {tab === "resources" && (
          <ResourcesTab
            phases={phases.data ?? []}
            resourcesFor={resourcesFor}
            loading={phases.loading}
          />
        )}
      </div>
    </div>
  );
}
