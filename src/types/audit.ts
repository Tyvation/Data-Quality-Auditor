export type DataType = "string" | "integer" | "float" | "boolean" | "datetime" | "category";

export interface SchemaField {
  name: string;
  dtype: DataType;
  nullable: boolean;
  description?: string;
  min?: number;
  max?: number;
  allowed_values?: string[];
  regex?: string;
}

export interface RuleDefinition {
  name: string;
  expression: string;
  severity: "info" | "warning" | "error";
  description?: string;
}

export interface AuditConfig {
  dataset_name: string;
  primary_key?: string[];
  schema: SchemaField[];
  rules: RuleDefinition[];
}

export interface AuditSummary {
  dataset_name: string;
  row_count: number;
  column_count: number;
  created_at: string;
  engine_used: "pandas" | "duckdb";
  issues_found: number;
}

export interface SchemaResult {
  field: string;
  expected_dtype: DataType;
  actual_dtype?: string | null;
  status: "ok" | "missing" | "type_mismatch";
  details?: string | null;
}

export interface MissingValueStat {
  column: string;
  missing_count: number;
  missing_pct: number;
}

export interface RuleResult {
  name: string;
  severity: "info" | "warning" | "error";
  passed: boolean;
  failing_rows: number;
  sample_rows: Record<string, string>[];
  description?: string | null;
}

export interface AuditReport {
  id: string;
  summary: AuditSummary;
  schema_results: SchemaResult[];
  missing_values: MissingValueStat[];
  rule_results: RuleResult[];
  sample_rows: Record<string, string>[];
  config: AuditConfig;
  source_file: string;
}

export interface StoredReportMetadata {
  id: string;
  dataset_name: string;
  created_at: string;
  issues_found: number;
  report_path?: string;
}
