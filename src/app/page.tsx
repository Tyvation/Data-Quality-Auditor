"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AuditConfig,
  AuditReport,
  MissingValueStat,
  RuleDefinition,
  SchemaField,
  StoredReportMetadata,
} from "@/types/audit";
import { apiUrl, fetchJSON } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const dtypeOptions = ["string", "integer", "float", "boolean", "datetime", "category"] as const;
const severityOptions = ["info", "warning", "error"] as const;

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
  const [compareIds, setCompareIds] = useState<{ a?: string; b?: string }>({});
  const [comparison, setComparison] = useState<{ a: AuditReport; b: AuditReport } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);

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

  const updateSchemaField = (index: number, field: Partial<SchemaField>) => {
    setConfig((prev) => {
      const nextSchema = [...prev.schema];
      nextSchema[index] = { ...nextSchema[index], ...field };
      return { ...prev, schema: nextSchema };
    });
  };

  const addSchemaField = () => {
    setConfig((prev) => ({
      ...prev,
      schema: [
        ...prev.schema,
        { name: `field_${prev.schema.length + 1}`, dtype: "string", nullable: true },
      ],
    }));
  };

  const removeSchemaField = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      schema: prev.schema.filter((_, idx) => idx !== index),
    }));
  };

  const updateRule = (index: number, rule: Partial<RuleDefinition>) => {
    setConfig((prev) => {
      const nextRules = [...prev.rules];
      nextRules[index] = { ...nextRules[index], ...rule };
      return { ...prev, rules: nextRules };
    });
  };

  const addRule = () => {
    setConfig((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          name: `Rule ${prev.rules.length + 1}`,
          expression: "1 = 1",
          severity: "warning",
          description: "",
        },
      ],
    }));
  };

  const removeRule = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, idx) => idx !== index),
    }));
  };

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

  const handleCompare = async () => {
    if (!compareIds.a || !compareIds.b || compareIds.a === compareIds.b) {
      setMessage("Choose two different reports to compare.");
      return;
    }
    try {
      const [reportA, reportB] = await Promise.all([
        fetchJSON<AuditReport>(`/reports/${compareIds.a}`),
        fetchJSON<AuditReport>(`/reports/${compareIds.b}`),
      ]);
      setComparison({ a: reportA, b: reportB });
    } catch (error) {
      setMessage(`Comparison failed: ${(error as Error).message}`);
    }
  };

  const renderMissingChart = (items: MissingValueStat[]) => {
    if (!items.length) return <p className="text-sm text-gray-500">No missing value issues detected.</p>;
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={items}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="column" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="missing_count" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-3 rounded-2xl bg-slate-900 p-6 shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-blue-300">Data Quality Auditor</p>
              <h1 className="text-3xl font-semibold">Configurable audit pipeline</h1>
            </div>
            <button
              onClick={fetchTemplate}
              disabled={loadingTemplate}
              className="rounded-lg border border-blue-400 px-4 py-2 text-sm font-medium text-blue-200 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingTemplate ? "Loading template..." : "Load template config"}
            </button>
          </div>
          <p className="text-sm text-slate-300">
            Offline-friendly desktop experience powered by FastAPI + DuckDB/Pandas with a Next.js operator console.
          </p>
          {message && <p className="text-sm text-amber-200">{message}</p>}
        </header>

        <section className="rounded-2xl bg-slate-900 p-6 shadow-lg shadow-blue-500/10">
          <h2 className="text-xl font-semibold text-blue-200">Upload Data</h2>
          <p className="mb-4 text-sm text-slate-300">
            Accepts CSV, TSV, and Excel files. Automatically routes datasets up to 1GB through pandas and larger files
            through DuckDB.
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <input
              type="file"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              onClick={runAudit}
              disabled={!file || isRunning}
              className="rounded-lg bg-blue-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? "Running..." : "Run Audit"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-6 shadow-lg shadow-blue-500/10">
          <h2 className="text-xl font-semibold text-blue-200">Load & Configure Rules</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">Schema definition</h3>
                <button
                  onClick={addSchemaField}
                  className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800"
                >
                  Add column
                </button>
              </div>
              <div className="space-y-3">
                {config.schema.map((item, index) => (
                  <div key={index} className="rounded-lg border border-slate-700 p-3 text-sm">
                    <div className="flex gap-2">
                      <input
                        value={item.name}
                        onChange={(event) => updateSchemaField(index, { name: event.target.value })}
                        className="flex-1 rounded bg-slate-800 px-2 py-1"
                      />
                      <select
                        value={item.dtype}
                        onChange={(event) => updateSchemaField(index, { dtype: event.target.value as SchemaField["dtype"] })}
                        className="rounded bg-slate-800 px-2 py-1"
                      >
                        {dtypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.nullable}
                          onChange={(event) => updateSchemaField(index, { nullable: event.target.checked })}
                        />
                        Nullable
                      </label>
                      <input
                        type="text"
                        placeholder="Allowed values comma-separated"
                        value={item.allowed_values?.join(", ") ?? ""}
                        onChange={(event) =>
                          updateSchemaField(index, {
                            allowed_values: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-1/2 rounded bg-slate-800 px-2 py-1"
                      />
                      <button
                        onClick={() => removeSchemaField(index)}
                        className="text-rose-300 transition hover:text-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!config.schema.length && (
                  <p className="text-sm text-slate-400">No schema columns configured yet.</p>
                )}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-100">Rule checks</h3>
                <button
                  onClick={addRule}
                  className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800"
                >
                  Add rule
                </button>
              </div>
              <div className="space-y-3">
                {config.rules.map((rule, index) => (
                  <div key={index} className="rounded-lg border border-slate-700 p-3 text-sm space-y-2">
                    <input
                      value={rule.name}
                      onChange={(event) => updateRule(index, { name: event.target.value })}
                      className="w-full rounded bg-slate-800 px-2 py-1"
                    />
                    <textarea
                      value={rule.expression}
                      onChange={(event) => updateRule(index, { expression: event.target.value })}
                      rows={2}
                      className="w-full rounded bg-slate-800 px-2 py-1 font-mono text-xs"
                    />
                    <div className="flex items-center justify-between">
                      <select
                        value={rule.severity}
                        onChange={(event) =>
                          updateRule(index, { severity: event.target.value as RuleDefinition["severity"] })
                        }
                        className="rounded bg-slate-800 px-2 py-1"
                      >
                        {severityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Optional description"
                        value={rule.description ?? ""}
                        onChange={(event) => updateRule(index, { description: event.target.value })}
                        className="w-2/3 rounded bg-slate-800 px-2 py-1"
                      />
                      <button
                        onClick={() => removeRule(index)}
                        className="text-rose-300 transition hover:text-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!config.rules.length && <p className="text-sm text-slate-400">No validation rules configured.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-900 p-6 shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-blue-200">View Results Dashboard</h2>
            {report && (
              <button
                onClick={() => downloadReport(report.id)}
                className="rounded border border-blue-300 px-4 py-2 text-xs text-blue-200 transition hover:bg-blue-500/10"
              >
                Download JSON
              </button>
            )}
          </div>
          {!report && <p className="text-sm text-slate-400">Run an audit to see results.</p>}
          {report && (
            <div className="mt-4 space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-slate-800/80 p-4 text-center">
                  <p className="text-xs uppercase text-slate-400">Rows</p>
                  <p className="text-2xl font-bold">{report.summary.row_count.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-800/80 p-4 text-center">
                  <p className="text-xs uppercase text-slate-400">Columns</p>
                  <p className="text-2xl font-bold">{report.summary.column_count}</p>
                </div>
                <div className="rounded-lg bg-slate-800/80 p-4 text-center">
                  <p className="text-xs uppercase text-slate-400">Engine</p>
                  <p className="text-2xl font-bold">{report.summary.engine_used}</p>
                </div>
                <div className="rounded-lg bg-slate-800/80 p-4 text-center">
                  <p className="text-xs uppercase text-slate-400">Issues</p>
                  <p className="text-2xl font-bold">{report.summary.issues_found}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold text-slate-100">Missing value analysis</h3>
                {renderMissingChart(report.missing_values)}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-100">Schema validation</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-800 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Field</th>
                          <th className="px-3 py-2">Expected</th>
                          <th className="px-3 py-2">Actual</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.schema_results.map((result) => (
                          <tr key={result.field} className="border-b border-slate-800">
                            <td className="px-3 py-2">{result.field}</td>
                            <td className="px-3 py-2">{result.expected_dtype}</td>
                            <td className="px-3 py-2">{result.actual_dtype ?? "-"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded px-2 py-1 text-xs ${
                                  result.status === "ok" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
                                }`}
                              >
                                {result.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-100">Rule checks</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-800 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Rule</th>
                          <th className="px-3 py-2">Severity</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Failing rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rule_results.map((rule) => (
                          <tr key={rule.name} className="border-b border-slate-800">
                            <td className="px-3 py-2">{rule.name}</td>
                            <td className="px-3 py-2 capitalize">{rule.severity}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded px-2 py-1 text-xs ${
                                  rule.passed ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
                                }`}
                              >
                                {rule.passed ? "Passed" : "Failed"}
                              </span>
                            </td>
                            <td className="px-3 py-2">{rule.failing_rows}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold text-slate-100">Sample records</h3>
                <pre className="max-h-56 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs">
                  {JSON.stringify(report.sample_rows, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-slate-900 p-6 shadow-lg shadow-blue-500/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-blue-200">Download & Compare Reports</h2>
              <p className="text-sm text-slate-400">Reports are stored locally and can be exported as JSON.</p>
            </div>
            <div className="flex gap-3">
              <select
                value={compareIds.a ?? ""}
                onChange={(event) => setCompareIds((prev) => ({ ...prev, a: event.target.value || undefined }))}
                className="rounded bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Select report A</option>
                {reports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.dataset_name} · {new Date(item.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
              <select
                value={compareIds.b ?? ""}
                onChange={(event) => setCompareIds((prev) => ({ ...prev, b: event.target.value || undefined }))}
                className="rounded bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Select report B</option>
                {reports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.dataset_name} · {new Date(item.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCompare}
                className="rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                Compare
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Dataset</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Issues</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800">
                    <td className="px-3 py-2">{item.dataset_name}</td>
                    <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{item.issues_found}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button
                        onClick={() => loadReport(item.id)}
                        className="text-xs text-blue-300 hover:text-blue-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadReport(item.id)}
                        className="text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
                {!reports.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                      No historical audits stored yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {comparison && (
            <div className="mt-6 grid gap-4 rounded-xl border border-slate-800 p-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-slate-400">Report A issues</p>
                <p className="text-2xl font-semibold text-rose-200">{comparison.a.summary.issues_found}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Report B issues</p>
                <p className="text-2xl font-semibold text-emerald-200">{comparison.b.summary.issues_found}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Delta</p>
                {(() => {
                  const delta =
                    comparison.b.summary.issues_found - comparison.a.summary.issues_found;
                  const tone =
                    delta > 0 ? "text-rose-200" : delta < 0 ? "text-emerald-200" : "text-slate-200";
                  return <p className={`text-2xl font-semibold ${tone}`}>{delta}</p>;
                })()}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
