import type { FormatterPreset } from "./plugin-types";

export interface FormattedValue {
  displayValue: string;
  className?: string;
  isExpandable?: boolean;
  fullValue?: string;
}

function formatRelativeDate(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { displayValue: String(value) };
  }
  const now = Date.now();
  const diffMs = now - date.getTime();
  const absDiff = Math.abs(diffMs);
  const future = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let relative: string;
  if (seconds < 60) relative = "just now";
  else if (minutes < 60) relative = `${minutes}m`;
  else if (hours < 24) relative = `${hours}h`;
  else if (days < 7) relative = `${days}d`;
  else if (weeks < 5) relative = `${weeks}w`;
  else if (months < 12) relative = `${months}mo`;
  else relative = `${years}y`;

  if (relative !== "just now") {
    relative = future ? `in ${relative}` : `${relative} ago`;
  }

  return {
    displayValue: relative,
    className: "text-muted",
    fullValue: String(value),
  };
}

function formatJsonPretty(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  try {
    const obj = typeof value === "string" ? JSON.parse(value) : value;
    const pretty = JSON.stringify(obj, null, 2);
    const preview =
      pretty.length > 80 ? pretty.slice(0, 80) + "..." : pretty;
    return {
      displayValue: preview,
      className: "font-mono text-xs",
      isExpandable: pretty.length > 80,
      fullValue: pretty,
    };
  } catch {
    return { displayValue: String(value) };
  }
}

function formatBooleanBadge(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  const boolVal =
    value === true || value === "true" || value === "t" || value === 1;
  return {
    displayValue: boolVal ? "true" : "false",
    className: boolVal
      ? "inline-block px-1.5 py-0.5 text-xs rounded bg-success/15 text-success font-medium"
      : "inline-block px-1.5 py-0.5 text-xs rounded bg-danger/15 text-danger font-medium",
  };
}

function formatByteSize(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  const num = Number(value);
  if (isNaN(num)) return { displayValue: String(value) };
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = num;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return {
    displayValue: `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`,
    fullValue: String(num),
  };
}

function formatTruncateLong(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  const str = String(value);
  if (str.length <= 200) {
    return { displayValue: str };
  }
  return {
    displayValue: str.slice(0, 200) + "...",
    isExpandable: true,
    fullValue: str,
  };
}

function formatUrlLink(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  const str = String(value);
  if (/^https?:\/\/.+/.test(str)) {
    return {
      displayValue: str,
      className: "text-accent underline",
    };
  }
  return { displayValue: str };
}

function formatNumberComma(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { displayValue: "NULL", className: "text-muted italic" };
  }
  const num = Number(value);
  if (isNaN(num)) return { displayValue: String(value) };
  return { displayValue: num.toLocaleString() };
}

export function applyFormatter(
  value: any,
  preset: FormatterPreset
): FormattedValue {
  switch (preset) {
    case "relative-date":
      return formatRelativeDate(value);
    case "json-pretty":
      return formatJsonPretty(value);
    case "boolean-badge":
      return formatBooleanBadge(value);
    case "byte-size":
      return formatByteSize(value);
    case "truncate-long":
      return formatTruncateLong(value);
    case "url-link":
      return formatUrlLink(value);
    case "number-comma":
      return formatNumberComma(value);
    case "none":
    default:
      return {
        displayValue:
          value === null || value === undefined ? "NULL" : String(value),
        className:
          value === null || value === undefined ? "text-muted italic" : undefined,
      };
  }
}
