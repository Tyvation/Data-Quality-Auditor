"use client";

import { useCallback, useEffect, useState } from "react";
import { AuditConfig, AuditReport, StoredReportMetadata } from "@/types/audit";
import { apiUrl, fetchJSON } from "@/lib/api";
import AuditConfigForm from "@/components/AuditConfigForm";
import AuditReportView from "@/components/AuditReportView";
import ComparisonView from "@/components/ComparisonView";

const panelClass =
  "rounded-3xl border border-white/5 bg-[#11141c]/80 backdrop-blur-xl shadow-[0_20px_45px_rgba(0,0,0,0.45)] p-6 md:p-8";

export default function Home() {
  const [config, setConfig] = useState<AuditConfig>({
    dataset_name: "uploaded_dataset",
    primary_key: [],
    schema: [],
    rules: [],
  });
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [reports, setReports] = useState<StoredReportMetadata[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  const fetchTemplate = useCallback(async () => {
    setLoadingTemplate(true);
    try {
      const template = await fetchJSON<AuditConfig>("/config/template");
      setConfig(template);
    } catch (error) {
      setMessage(`Unable to load template: ${(error as Error).message}`);
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  const refreshReports = useCallback(async () => {
    try {
      const data = await fetchJSON<StoredReportMetadata[]>("/reports");
      setReports(data);
    } catch (error) {
      setMessage(`Unable to load reports: ${(error as Error).message}`);
    }
  }, []);

  useEffect(() => {
    fetchTemplate();
    refreshReports();
  }, [fetchTemplate, refreshReports]);

  useEffect(() => {
    if (!file) {
      setAvailableColumns([]);
      return;
    }
    const fetchColumns = async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(apiUrl("/audit/schema"), {
          method: "POST",
          body: formData,
        });
        if (response.ok) {
          const cols = await response.json();
          setAvailableColumns(cols);
        }
      } catch (error) {
        console.error("Failed to fetch columns", error);
      }
    };
    fetchColumns();
  }, [file]);

  const runAudit = async () => {
    if (!file) {
      setMessage("Upload a CSV/Excel file first.");
      return;
    }
    setIsRunning(true);
    setMessage("Running audit...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify(config));
      const response = await fetch(apiUrl("/audit/run"), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || "Audit failed");
      }
      const auditReport = (await response.json()) as AuditReport;
      setReport(auditReport);
      setMessage("Audit completed successfully.");
      await refreshReports();
    } catch (error) {
      setMessage(`Audit failed: ${(error as Error).message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const loadReport = async (reportId: string) => {
    try {
      const item = await fetchJSON<AuditReport>(`/reports/${reportId}`);
      setReport(item);
    } catch (error) {
      setMessage(`Unable to load report: ${(error as Error).message}`);
    }
  };

  const downloadReport = (reportId: string) => {
    window.open(apiUrl(`/reports/${reportId}/download`), "_blank");
  };

  const deleteReport = async (reportId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this report permanently?");
      if (!confirmed) {
        return;
      }
    }
    try {
      const response = await fetch(apiUrl(`/reports/${reportId}`), { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      if (report?.id === reportId) {
        setReport(null);
      }
      await refreshReports();
      setMessage("Report deleted.");
    } catch (error) {
      setMessage(`Unable to delete report: ${(error as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0F12] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#121826] via-[#0f1928] to-[#1b1231] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-[#8A4DFF]/40 blur-[120px]" />
            <div className="absolute -left-8 bottom-0 h-48 w-48 rounded-full bg-[#00FFAA]/30 blur-[130px]" />
          </div>
          <div className="relative z-[1] flex flex-col gap-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-[#8A4DFF]">Data Quality Auditor</p>
                <h1 className="text-4xl font-semibold text-white">Precision observability for tabular datasets</h1>
              </div>
              <button
                onClick={fetchTemplate}
                disabled={loadingTemplate}
                className="rounded-full bg-gradient-to-r from-[#00FFAA] to-[#53ffe0] px-5 py-2 text-sm font-semibold text-black shadow-[0_10px_25px_rgba(0,255,170,0.3)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingTemplate ? "Loading template..." : "Load template"}
              </button>
            </div>
            <p className="text-base text-[#9BA0A8] md:w-3/4">
              Offline desktop workflow backed by FastAPI, DuckDB, and Pandas. Configure schema, apply industrial-grade
              checks, and compare historical audits inside a unified console.
            </p>
            {message && <p className="text-sm text-[#ffde8a]">{message}</p>}
          </div>
        </header>

        <section className={panelClass}>
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-[#8A4DFF]">Step 1</p>
            <h2 className="text-2xl font-semibold text-white">Upload dataset</h2>
            <p className="text-sm text-[#9BA0A8]">
              Accepts CSV, TSV, and Excel files. Automatically routes datasets up to 1GB through pandas and larger files
              through DuckDB.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <input
              type="file"
              className="w-full rounded-2xl border border-white/10 bg-[#0D0F12] px-4 py-3 text-sm text-white placeholder:text-[#4f5661]"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              onClick={runAudit}
              disabled={!file || isRunning}
              className="rounded-full bg-gradient-to-r from-[#00FFAA] via-[#1de7c2] to-[#8A4DFF] px-6 py-3 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(0,255,170,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunning ? "Running..." : "Run Audit"}
            </button>
          </div>
        </section>

        <AuditConfigForm config={config} setConfig={setConfig} availableColumns={availableColumns} />

        <AuditReportView report={report} />

        <ComparisonView
          reports={reports}
          setMessage={setMessage}
          loadReport={loadReport}
          downloadReport={downloadReport}
          deleteReport={deleteReport}
        />
      </div>
    </div>
  );
}
