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
          className="btn btn-sm"
        >
          {({ loading }) => (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {loading ? "Preparing…" : "Download PDF"}
            </>
          )}
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
