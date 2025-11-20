import { AuditReport, StoredReportMetadata } from "@/types/audit";
import { fetchJSON } from "@/lib/api";
import { Dispatch, SetStateAction, useState } from "react";

const panelClass =
    "rounded-3xl border border-white/5 bg-[#11141c]/80 backdrop-blur-xl shadow-[0_20px_45px_rgba(0,0,0,0.45)] p-6 md:p-8";

interface ComparisonViewProps {
    reports: StoredReportMetadata[];
    setMessage: Dispatch<SetStateAction<string>>;
    loadReport: (id: string) => void;
    downloadReport: (id: string) => void;
    deleteReport: (id: string) => void;
}

export default function ComparisonView({
    reports,
    setMessage,
    loadReport,
    downloadReport,
    deleteReport,
}: ComparisonViewProps) {
    const [compareIds, setCompareIds] = useState<{ a?: string; b?: string }>({});
    const [comparison, setComparison] = useState<{ a: AuditReport; b: AuditReport } | null>(null);

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

    return (
        <section className={panelClass}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#8A4DFF]">Step 4</p>
                    <h2 className="text-2xl font-semibold text-white">History & comparisons</h2>
                    <p className="text-sm text-[#9BA0A8]">Reports live locally with instant diffing for regression detection.</p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={compareIds.a ?? ""}
                        onChange={(event) => setCompareIds((prev) => ({ ...prev, a: event.target.value || undefined }))}
                        className="rounded-2xl border border-white/10 bg-transparent px-3 py-2 text-sm"
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
                        className="rounded-2xl border border-white/10 bg-transparent px-3 py-2 text-sm"
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
                        className="rounded-full bg-gradient-to-r from-[#00FFAA] to-[#8A4DFF] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_25px_rgba(0,0,0,0.4)] transition hover:opacity-90"
                    >
                        Compare
                    </button>
                </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase text-[#9BA0A8]">
                        <tr>
                            <th className="px-3 py-2">Dataset</th>
                            <th className="px-3 py-2">Created</th>
                            <th className="px-3 py-2">Issues</th>
                            <th className="px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((item) => (
                            <tr key={item.id} className="border-b border-white/5">
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
                                    <button
                                        onClick={() => deleteReport(item.id)}
                                        className="text-xs text-rose-300 hover:text-rose-200"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!reports.length && (
                            <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-[#4f5661]">
                                    No historical audits stored yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {comparison && (
                <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-3">
                    <div>
                        <p className="text-xs uppercase text-[#9BA0A8]">Report A issues</p>
                        <p className="text-2xl font-semibold text-rose-200">{comparison.a.summary.issues_found}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase text-[#9BA0A8]">Report B issues</p>
                        <p className="text-2xl font-semibold text-emerald-200">{comparison.b.summary.issues_found}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase text-[#9BA0A8]">Delta</p>
                        {(() => {
                            const delta = comparison.b.summary.issues_found - comparison.a.summary.issues_found;
                            const tone = delta > 0 ? "text-rose-200" : delta < 0 ? "text-emerald-200" : "text-slate-200";
                            return <p className={`text-2xl font-semibold ${tone}`}>{delta}</p>;
                        })()}
                    </div>
                </div>
            )}
        </section>
    );
}
