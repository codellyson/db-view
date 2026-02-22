"use client";

import React, { useState } from "react";
import type { FormattedValue } from "@/lib/formatter-presets";

interface FormattedCellProps {
  formatted: FormattedValue;
  rawValue: any;
}

export const FormattedCell: React.FC<FormattedCellProps> = ({
  formatted,
  rawValue,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (formatted.isExpandable && expanded) {
    return (
      <div className="max-w-xs">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all text-primary">
          {formatted.fullValue || String(rawValue)}
        </pre>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="text-xs text-accent hover:underline mt-1"
        >
          Collapse
        </button>
      </div>
    );
  }

  return (
    <div
      className={`truncate ${formatted.className || ""}`}
      title={
        formatted.fullValue ||
        (rawValue !== null && rawValue !== undefined ? String(rawValue) : "NULL")
      }
    >
      <span>{formatted.displayValue}</span>
      {formatted.isExpandable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="ml-1 text-xs text-accent hover:underline"
        >
          more
        </button>
      )}
    </div>
  );
};
