import { SOURCE_VIDEO_GROUPS } from "../../content/source-videos";
import type { Phase, Resource } from "../../supabase/types";
import { SkeletonCard } from "../../components/Skeleton";
import { LinkRow, VideoCard, youtubeId } from "./shared";

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
  const resourceKey = (url: string) => youtubeId(url) ?? url.replace(/([?&])dl=[01]/, "");
  const seen = new Set(SOURCE_VIDEO_GROUPS.flatMap((group) => group.videos.map((video) => resourceKey(video.url))));
  const groups = phases
    .map((p) => ({ phase: p, resources: resourcesFor(p.id).filter((resource) => { const key = resourceKey(resource.url); if (seen.has(key)) return false; seen.add(key); return true; }) }))
    .filter((g) => g.resources.length > 0);

  return (
    <div className="ref-section">
      {loading && groups.length === 0 && <SkeletonCard lines={3} />}

      {SOURCE_VIDEO_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="h-section">{group.title}</h3>
          <div className="video-grid">
            {group.videos.map((video) => <VideoCard key={video.url} title={video.title} url={video.url} />)}
          </div>
        </section>
      ))}

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
