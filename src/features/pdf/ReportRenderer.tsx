import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import type {
  Engagement,
  Horse,
  Phase,
  Question,
  Rider,
  SessionWithRatings,
  TrifectaEvaluationWithScores,
  Week,
} from "../../supabase/types";
import { EngagementReport } from "./Report";

interface Props {
  engagement: Engagement;
  horse: Horse | null;
  sessions: SessionWithRatings[];
  weeks: Week[];
  phases: Phase[];
  riders: Rider[];
  questions: Question[];
  trifecta: TrifectaEvaluationWithScores | null;
  generatedAt: string;
}

export default function ReportRenderer(props: Props) {
  const baseName = props.horse?.name ?? "engagement";
  const filename = `${baseName.replace(/\s+/g, "_")}_TQA_report.pdf`;
  const doc = <EngagementReport {...props} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <PDFDownloadLink
          document={doc}
          fileName={filename}
          className="btn-primary text-sm"
        >
          {({ loading }) => (loading ? "Preparing…" : "Download PDF")}
        </PDFDownloadLink>
      </div>
      <div className="card p-0 overflow-hidden">
        <PDFViewer
          width="100%"
          height={800}
          style={{ border: "none", backgroundColor: "#0f172a" }}
          showToolbar
        >
          {doc}
        </PDFViewer>
      </div>
    </div>
  );
}
