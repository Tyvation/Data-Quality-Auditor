import { AuditConfig, RuleDefinition, SchemaField } from "@/types/audit";
import { Dispatch, SetStateAction } from "react";

const dtypeOptions = ["string", "integer", "float", "boolean", "datetime", "category"] as const;
const severityOptions = ["info", "warning", "error"] as const;
const panelClass =
  "rounded-3xl border border-white/5 bg-[#11141c]/80 backdrop-blur-xl shadow-[0_20px_45px_rgba(0,0,0,0.45)] p-6 md:p-8";

interface AuditConfigFormProps {
  config: AuditConfig;
  setConfig: Dispatch<SetStateAction<AuditConfig>>;
}

export default function AuditConfigForm({ config, setConfig }: AuditConfigFormProps) {
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

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-[#8A4DFF]">Step 2</p>
        <h2 className="text-2xl font-semibold text-white">Load & configure validation rules</h2>
        <p className="text-sm text-[#9BA0A8]">
          Define schema constraints, data ranges, enumerations, and custom expressions that the engine enforces.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">Schema definition</h3>
            <button
              onClick={addSchemaField}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#00FFAA] transition hover:bg-white/5"
            >
              Add column
            </button>
          </div>
          <div className="space-y-3">
            {config.schema.map((item, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-[#0D0F12] p-4 text-sm shadow-inner shadow-black/40">
                <div className="flex gap-2">
                  <input
                    value={item.name}
                    onChange={(event) => updateSchemaField(index, { name: event.target.value })}
                    className="flex-1 rounded-xl border border-white/10 bg-transparent px-3 py-2"
                  />
                  <select
                    value={item.dtype}
                    onChange={(event) => updateSchemaField(index, { dtype: event.target.value as SchemaField["dtype"] })}
                    className="rounded-xl border border-white/10 bg-transparent px-3 py-2"
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
                    className="w-1/2 rounded-xl border border-white/10 bg-transparent px-3 py-2"
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
              <p className="text-sm text-[#4f5661]">No schema columns configured yet.</p>
            )}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">Rule checks</h3>
            <button
              onClick={addRule}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#00FFAA] transition hover:bg-white/5"
            >
              Add rule
            </button>
          </div>
          <div className="space-y-3">
            {config.rules.map((rule, index) => (
              <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#0D0F12] p-4 text-sm shadow-inner shadow-black/40">
                <input
                  value={rule.name}
                  onChange={(event) => updateRule(index, { name: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2"
                />
                <textarea
                  value={rule.expression}
                  onChange={(event) => updateRule(index, { expression: event.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 font-mono text-xs"
                />
                <div className="flex items-center justify-between">
                  <select
                    value={rule.severity}
                    onChange={(event) =>
                      updateRule(index, { severity: event.target.value as RuleDefinition["severity"] })
                    }
                    className="rounded-xl border border-white/10 bg-transparent px-3 py-2"
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
                    className="w-2/3 rounded-xl border border-white/10 bg-transparent px-3 py-2"
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
            {!config.rules.length && <p className="text-sm text-[#4f5661]">No validation rules configured.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
