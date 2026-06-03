export interface TemplateVariable {
  name: string;
  label: string;
  type: "text" | "select";
  options?: string[];
  defaultValue?: string;
}

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  sql: string;
  tags: string[];
  dialect: "postgresql" | "mysql" | "sqlite" | "universal";
  category: "performance" | "schema" | "data" | "admin" | "custom";
  isBuiltIn: boolean;
  variables: TemplateVariable[];
}

export type FormatterPreset =
  | "relative-date"
  | "json-pretty"
  | "boolean-badge"
  | "byte-size"
  | "truncate-long"
  | "url-link"
  | "number-comma"
  | "none";

export interface FormatterMatcher {
  type: "data-type" | "column-name" | "column-name-pattern";
  value: string;
}

export interface ColumnFormatter {
  id: string;
  name: string;
  description: string;
  matcher: FormatterMatcher;
  preset: FormatterPreset;
  isBuiltIn: boolean;
}

export interface PluginConfig {
  templates: QueryTemplate[];
  formatters: ColumnFormatter[];
  disabledBuiltIns: string[];
}
