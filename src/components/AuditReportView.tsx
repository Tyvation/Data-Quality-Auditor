import { AuditReport, MissingValueStat } from "@/types/audit";
import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { apiUrl } from "@/lib/api";

const panelClass =
    "rounded-3xl border border-white/5 bg-[#11141c]/80 backdrop-blur-xl shadow-[0_20px_45px_rgba(0,0,0,0.45)] p-6 md:p-8";

interface AuditReportViewProps {
    report: AuditReport | null;
}

export default function AuditReportView({ report }: AuditReportViewProps) {
    const allIssues = useMemo(() => {
        if (!report) return [];
        const issues: Array<{
            rowId: string;
            value: string;
            errorType: string;
            ruleOrColumn: string;
            severity: "info" | "warning" | "error";
        }> = [];

        // 1. Rule Failures
        report.rule_results.forEach((rule) => {
            if (!rule.passed && rule.sample_rows) {
                rule.sample_rows.forEach((sample) => {
                    const enrichedSample = sample as Record<string, string> & { __line__?: string };
                    issues.push({
                        rowId: enrichedSample.__line__ ?? "n/a",
                        value: JSON.stringify(sample), // Or specific column if possible, but rule might involve multiple
                        errorType: "Rule Failed",
                        ruleOrColumn: rule.name,
                        severity: rule.severity,
                    });
                });
            }
        });

        // 2. Missing Values
        report.missing_values.forEach((mv) => {
            if (mv.missing_count > 0 && mv.sample_rows) {
                mv.sample_rows.forEach((sample) => {
                    const enrichedSample = sample as Record<string, string> & { __line__?: string };
                    issues.push({
                        rowId: enrichedSample.__line__ ?? "n/a",
                        value: "NULL / Empty",
                        errorType: "Missing Value",
                        ruleOrColumn: mv.column,
                        severity: mv.missing_pct > 10 ? "error" : "warning",
                    });
                });
            }
        });

        // 3. Primary Key Issues
        if (report.primary_key_result) {
            const pkCols = report.primary_key_result.columns.join(", ");
            report.primary_key_result.sample_rows.forEach((sample) => {
                const enrichedSample = sample as Record<string, string> & { __line__?: string };
                // Determine if it's a duplicate or null based on the data? 
                // The backend returns mixed samples. We can infer or just label generic "PK Issue"
                // For simplicity, let's check if PK columns are null
                const isNull = report.primary_key_result?.columns.some(col => !sample[col]);

                issues.push({
                    rowId: enrichedSample.__line__ ?? "n/a",
                    value: JSON.stringify(sample),
                    errorType: isNull ? "PK Null" : "PK Duplicate",
                    ruleOrColumn: pkCols,
                    severity: "error",
                });
            });
        }

        return issues.sort((a, b) => {
            // Try to sort by row ID if it's a number
            const rowA = parseInt(a.rowId);
            const rowB = parseInt(b.rowId);
            if (!isNaN(rowA) && !isNaN(rowB)) return rowA - rowB;
            return a.rowId.localeCompare(b.rowId);
        });
    }, [report]);



    const issueIndicators = useMemo(() => {
        if (!report) return [];
        const indicators: Array<{ label: string; detail: string; severity: "info" | "warning" | "error" }> = [];

        report.schema_results.forEach((item) => {
            if (item.status === "missing") {
                indicators.push({
                    label: `Missing column`,
                    detail: item.field,
                    severity: "error",
                });
            } else if (item.status === "type_mismatch") {
                indicators.push({
                    label: `Type mismatch`,
                    detail: `${item.field}: expected ${item.expected_dtype}, found ${item.actual_dtype ?? "n/a"}`,
                    severity: "warning",
                });
            }
        });

        report.missing_values.forEach((item) => {
            if (item.missing_count > 0) {
                indicators.push({
                    label: `Missing data`,
                    detail: `${item.column}: ${item.missing_pct.toFixed(1)}%`,
                    severity: item.missing_pct > 10 ? "error" : "warning",
                });
            }
        });

        report.rule_results.forEach((rule) => {
            if (!rule.passed) {
                indicators.push({
                    label: `Rule failed`,
                    detail: `${rule.name} (${rule.failing_rows} rows)`,
                    severity: rule.severity,
                });
            }
        });

        if (report.primary_key_result) {
            if (report.primary_key_result.duplicate_count > 0) {
                indicators.push({
                    label: "PK duplicate",
                    detail: `${report.primary_key_result.duplicate_count} rows`,
                    severity: "error",
                });
            }
            if (report.primary_key_result.null_count > 0) {
                indicators.push({
                    label: "PK null",
                    detail: `${report.primary_key_result.null_count} rows`,
                    severity: "error",
                });
            }
        }

        return indicators;
    }, [report]);

    const downloadReport = (reportId: string) => {
        window.open(apiUrl(`/reports/${reportId}/download`), "_blank");
    };

    const renderMissingChart = (items: MissingValueStat[]) => {
        if (!items.length) return <p className="text-sm text-gray-500">No missing value issues detected.</p>;
        return (
            <div className="h-64 w-full">
                <ResponsiveContainer>
                    <BarChart data={items} layout="vertical">
                        <defs>
                            <linearGradient id="missingBar" x1="0" x2="1" y1="0" y2="0">
                                <stop offset="0%" stopColor="#00FFAA" />
                                <stop offset="100%" stopColor="#8A4DFF" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                            type="number"
                            allowDataOverflow
                            domain={[0, (dataMax: number) => Math.max(dataMax, 5)]}
                            tickFormatter={(value) => value.toString()}
                            tick={{ fill: "#9BA0A8" }}
                            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                            tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
                        />
                        <YAxis
                            type="category"
                            dataKey="column"
                            width={140}
                            tick={{ fill: "#9BA0A8" }}
                            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                            tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
                        />
                        <Tooltip
                            contentStyle={{ background: "#11141c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}
                        />
                        <ReferenceLine
                            x={5}
                            stroke="#8A4DFF"
                            strokeDasharray="6 6"
                            label={{ value: "min 5", position: "top", fill: "#8A4DFF", fontSize: 12 }}
                        />
                        <Bar dataKey="missing_count" fill="url(#missingBar)" radius={[0, 20, 20, 0]} barSize={18} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    return (
        <section className={panelClass}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#8A4DFF]">Step 3</p>
                    <h2 className="text-2xl font-semibold text-white">Quality scorecard</h2>
                </div>
                {report && (
                    <button
                        onClick={() => downloadReport(report.id)}
                        className="rounded-full border border-white/20 px-4 py-2 text-xs text-[#00FFAA] transition hover:bg-white/5"
                    >
                        Download JSON
                    </button>
                )}
            </div>
            {!report && <p className="text-sm text-[#4f5661]">Run an audit to see results.</p>}
            {report && (
                <div className="mt-4 space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl bg-gradient-to-br from-[#151c29] to-[#0e131b] p-4 text-center shadow-inner shadow-black/40">
                            <p className="text-xs uppercase tracking-[0.4em] text-[#9BA0A8]">Rows</p>
                            <p className="mt-2 text-3xl font-bold text-white">{report.summary.row_count.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-[#151c29] to-[#0e131b] p-4 text-center shadow-inner shadow-black/40">
                            <p className="text-xs uppercase tracking-[0.4em] text-[#9BA0A8]">Columns</p>
                            <p className="mt-2 text-3xl font-bold text-white">{report.summary.column_count}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-[#151c29] to-[#0e131b] p-4 text-center shadow-inner shadow-black/40">
                            <p className="text-xs uppercase tracking-[0.4em] text-[#9BA0A8]">Engine</p>
                            <p className="mt-2 text-3xl font-bold capitalize text-white">{report.summary.engine_used}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-[#151c29] to-[#0e131b] p-4 text-center shadow-inner shadow-black/40">
                            <p className="text-xs uppercase tracking-[0.4em] text-[#9BA0A8]">Issues</p>
                            <p className="mt-2 text-3xl font-bold text-white">{report.summary.issues_found}</p>
                        </div>
                    </div>

                    {issueIndicators.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <h3 className="text-lg font-semibold text-white">Active issue indicators</h3>
                                <p className="text-xs uppercase tracking-[0.4em] text-[#9BA0A8]">
                                    {issueIndicators.length} alerts
                                </p>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {issueIndicators.map((indicator, idx) => {
                                    let tone = "border-blue-400/30 bg-blue-500/10 text-blue-100";
                                    if (indicator.severity === "error") {
                                        tone = "border-rose-500/30 bg-rose-500/10 text-rose-100";
                                    } else if (indicator.severity === "warning") {
                                        tone = "border-amber-400/30 bg-amber-500/10 text-amber-100";
                                    }
                                    return (
                                        <div
                                            key={`${indicator.label}-${indicator.detail}-${idx}`}
                                            className={`rounded-2xl border ${tone} px-4 py-3 text-sm`}
                                        >
                                            <p className="text-xs uppercase tracking-[0.3em] text-white/70">{indicator.label}</p>
                                            <p className="text-base text-white">{indicator.detail}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {report.primary_key_result && (
                        <div className="rounded-2xl border border-white/10 bg-[#0f131b] p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Primary key quality</h3>
                                    <p className="text-xs text-[#9BA0A8]">
                                        Columns: {report.primary_key_result.columns.join(", ")}
                                    </p>
                                </div>
                                <div className="grid gap-3 text-center sm:grid-cols-2 md:grid-cols-4">
                                    <div>
                                        <p className="text-xs uppercase text-[#9BA0A8]">Duplicates</p>
                                        <p
                                            className={`text-xl font-bold ${report.primary_key_result.duplicate_count ? "text-rose-200" : "text-emerald-200"
                                                }`}
                                        >
                                            {report.primary_key_result.duplicate_count}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase text-[#9BA0A8]">Null PK rows</p>
                                        <p
                                            className={`text-xl font-bold ${report.primary_key_result.null_count ? "text-rose-200" : "text-emerald-200"
                                                }`}
                                        >
                                            {report.primary_key_result.null_count}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {report.primary_key_result.sample_rows.length > 0 ? (
                                <pre className="mt-3 max-h-40 overflow-auto rounded-2xl bg-black/40 p-3 text-xs">
                                    {JSON.stringify(report.primary_key_result.sample_rows, null, 2)}
                                </pre>
                            ) : (
                                <p className="mt-3 text-xs text-emerald-300">No duplicate or null primary key rows detected.</p>
                            )}
                        </div>
                    )}

                    <div>
                        <h3 className="mb-2 text-lg font-semibold text-white">Missing value analysis</h3>
                        {renderMissingChart(report.missing_values)}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="mb-2 text-lg font-semibold text-white">Schema validation</h3>
                            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-white/5 text-xs uppercase text-[#9BA0A8]">
                                        <tr>
                                            <th className="px-3 py-2">Field</th>
                                            <th className="px-3 py-2">Expected</th>
                                            <th className="px-3 py-2">Actual</th>
                                            <th className="px-3 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.schema_results.map((result) => (
                                            <tr key={result.field} className="border-b border-white/5">
                                                <td className="px-3 py-2">{result.field}</td>
                                                <td className="px-3 py-2">{result.expected_dtype}</td>
                                                <td className="px-3 py-2">{result.actual_dtype ?? "-"}</td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className={`rounded px-2 py-1 text-xs ${result.status === "ok"
                                                            ? "bg-emerald-500/20 text-emerald-200"
                                                            : "bg-rose-500/20 text-rose-200"
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
                            <h3 className="mb-2 text-lg font-semibold text-white">Rule checks</h3>
                            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-white/5 text-xs uppercase text-[#9BA0A8]">
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
                                                        className={`rounded px-2 py-1 text-xs ${rule.passed ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
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

                    {allIssues.length > 0 && (
                        <div>
                            <h3 className="mb-2 text-lg font-semibold text-white">Detailed issue log</h3>
                            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="bg-white/5 text-xs uppercase text-[#9BA0A8]">
                                        <tr>
                                            <th className="px-3 py-2">Row</th>
                                            <th className="px-3 py-2">Value</th>
                                            <th className="px-3 py-2">Error Type</th>
                                            <th className="px-3 py-2">Rule / Column</th>
                                            <th className="px-3 py-2">Severity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allIssues.map((item, idx) => (
                                            <tr key={`${item.errorType}-${item.rowId}-${idx}`} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="px-3 py-2 font-mono text-xs text-[#9BA0A8]">{item.rowId}</td>
                                                <td className="px-3 py-2">
                                                    <div className="max-w-xs truncate text-xs text-white/80" title={item.value}>
                                                        {item.value}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">{item.errorType}</td>
                                                <td className="px-3 py-2">{item.ruleOrColumn}</td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className={`rounded px-2 py-1 text-xs capitalize ${item.severity === "error"
                                                            ? "bg-rose-500/20 text-rose-200"
                                                            : item.severity === "warning"
                                                                ? "bg-amber-500/20 text-amber-200"
                                                                : "bg-blue-500/20 text-blue-200"
                                                            }`}
                                                    >
                                                        {item.severity}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="mb-2 text-lg font-semibold text-white">Sample records</h3>
                        <pre className="max-h-56 overflow-x-auto rounded-2xl bg-black/30 p-4 text-xs">
                            {JSON.stringify(report.sample_rows, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </section>
    );
}
