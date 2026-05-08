import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import type {
  Horse,
  Phase,
  Question,
  SessionWithRatings,
  TrifectaEvaluationWithScores,
} from "../../supabase/types";
import { HorseReport } from "./Report";

interface Props {
  horse: Horse;
  sessions: SessionWithRatings[];
  phases: Phase[];
  questions: Question[];
  trifecta: TrifectaEvaluationWithScores | null;
  generatedAt: string;
}

export default function ReportRenderer(props: Props) {
  const filename = `${props.horse.name.replace(/\s+/g, "_")}_TQA_report.pdf`;
  const doc = <HorseReport {...props} />;

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
