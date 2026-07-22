import type { Phase, Resource } from "../../supabase/types";
import { SkeletonCard } from "../../components/Skeleton";
import { LinkRow, VideoCard, youtubeId } from "./shared";
import { FFP_WALKTHROUGH_URL } from "./content";

// Videos & Resources — a real media library: video cards with thumbnails in a
// grid, plain links as rows, grouped by phase.
export default function ResourcesTab({
  phases,
  resourcesFor,
  loading,
}: {
  phases: Phase[];
  resourcesFor: (phaseId: string) => Resource[];
  loading: boolean;
}) {
  const groups = phases
    .map((p) => ({ phase: p, resources: resourcesFor(p.id) }))
    .filter((g) => g.resources.length > 0);

  return (
    <div className="ref-section">
      <div>
        <h3 className="h-section" style={{ marginTop: 4 }}>
          TQA essentials
        </h3>
        <div className="video-grid">
          <VideoCard
            title="Wade Black walks through the Foundation for Perfection"
            url={FFP_WALKTHROUGH_URL}
            sub="The doctrine behind every score sheet"
          />
        </div>
      </div>

      {loading && groups.length === 0 && <SkeletonCard lines={3} />}

      {!loading && groups.length === 0 && (
        <div className="card muted" style={{ textAlign: "center" }}>
          <p style={{ margin: 0 }}>
            No resources attached to phases yet. Add videos and links from a
            phase's score sheet, and they'll be collected here.
          </p>
        </div>
      )}

      {groups.map(({ phase, resources }) => {
        const videos = resources.filter((r) => youtubeId(r.url) != null);
        const links = resources.filter((r) => youtubeId(r.url) == null);
        return (
          <div key={phase.id}>
            <h3 className="h-section">
              {phase.name}
              <span
                className="mono muted"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginLeft: 10,
                }}
              >
                {resources.length} resource{resources.length !== 1 ? "s" : ""}
              </span>
            </h3>
            {videos.length > 0 && (
              <div
                className="video-grid"
                style={{ marginBottom: links.length > 0 ? 10 : 0 }}
              >
                {videos.map((r) => (
                  <VideoCard key={r.id} title={r.title} url={r.url} sub={r.notes} />
                ))}
              </div>
            )}
            {links.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {links.map((r) => (
                  <LinkRow key={r.id} title={r.title} url={r.url} sub={r.notes} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
