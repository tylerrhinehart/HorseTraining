import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import type {
  Horse,
  Phase,
  Question,
  TQAWithRatings,
} from "../../supabase/types";
import { HorseReport } from "./Report";

interface Props {
  horse: Horse;
  tqas: TQAWithRatings[];
  questions: Question[];
  phases: Phase[];
  generatedAt: string;
}

export default function ReportRenderer({
  horse,
  tqas,
  questions,
  phases,
  generatedAt,
}: Props) {
  const filename = `${horse.name.replace(/\s+/g, "_")}_TQA_report.pdf`;
  const doc = (
    <HorseReport
      horse={horse}
      tqas={tqas}
      questions={questions}
      phases={phases}
      generatedAt={generatedAt}
    />
  );

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
