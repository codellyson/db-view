"use client";

import React, { useState } from "react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { DEFAULT_TEMPLATES, DEFAULT_FORMATTERS } from "@/lib/default-plugins";
import type { FormatterPreset, FormatterMatcher } from "@/lib/plugin-types";
import { usePlugins } from "../hooks/use-plugins";

interface FormatterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_OPTIONS: { value: FormatterPreset; label: string }[] = [
  { value: "relative-date", label: "Relative Date" },
  { value: "json-pretty", label: "Pretty JSON" },
  { value: "boolean-badge", label: "Boolean Badge" },
  { value: "byte-size", label: "Byte Size" },
  { value: "truncate-long", label: "Truncate Long" },
  { value: "url-link", label: "URL Link" },
  { value: "number-comma", label: "Number Comma" },
];

const MATCHER_TYPE_OPTIONS: { value: FormatterMatcher["type"]; label: string }[] = [
  { value: "data-type", label: "Data Type" },
  { value: "column-name", label: "Column Name" },
  { value: "column-name-pattern", label: "Column Name Pattern" },
];

export const FormatterSettings: React.FC<FormatterSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const { config, allFormatters, addFormatter, deleteFormatter, toggleBuiltIn } = usePlugins();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMatcherType, setNewMatcherType] = useState<FormatterMatcher["type"]>("data-type");
  const [newMatcherValue, setNewMatcherValue] = useState("");
  const [newPreset, setNewPreset] = useState<FormatterPreset>("relative-date");

  const handleAdd = () => {
    if (!newName.trim() || !newMatcherValue.trim()) return;
    addFormatter({
      name: newName,
      description: `Custom formatter: ${newPreset} for ${newMatcherType} '${newMatcherValue}'`,
      matcher: { type: newMatcherType, value: newMatcherValue },
      preset: newPreset,
    });
    setNewName("");
    setNewMatcherValue("");
    setShowAddForm(false);
  };

  const allBuiltIns = [...DEFAULT_FORMATTERS, ...DEFAULT_TEMPLATES];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Formatters"
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="text-xs text-secondary">
          Formatters automatically transform how cell values are displayed in data tables.
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-secondary">Built-in Formatters</div>
          {DEFAULT_FORMATTERS.map((f) => {
            const isDisabled = config.disabledBuiltIns.includes(f.id);
            return (
              <div
                key={f.id}
                className="flex items-center justify-between p-2.5 border border-border rounded-md"
              >
                <div>
                  <div className="text-sm font-medium text-primary">{f.name}</div>
                  <div className="text-xs text-muted">
                    {f.matcher.type}: {f.matcher.value} &rarr; {f.preset}
                  </div>
                </div>
                <button
                  onClick={() => toggleBuiltIn(f.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    !isDisabled ? "bg-accent" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      !isDisabled ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {allFormatters.filter((f) => !f.isBuiltIn).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-secondary">Custom Formatters</div>
            {allFormatters
              .filter((f) => !f.isBuiltIn)
              .map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 border border-border rounded-md"
                >
                  <div>
                    <div className="text-sm font-medium text-primary">{f.name}</div>
                    <div className="text-xs text-muted">
                      {f.matcher.type}: {f.matcher.value} &rarr; {f.preset}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteFormatter(f.id)}
                    className="text-xs text-danger hover:text-danger/80"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        )}

        {showAddForm ? (
          <div className="space-y-3 border border-border rounded-md p-3 bg-bg-secondary">
            <div className="text-xs font-medium text-secondary">New Formatter</div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Formatter name"
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
            />
            <div className="flex gap-2">
              <select
                value={newMatcherType}
                onChange={(e) => setNewMatcherType(e.target.value as FormatterMatcher["type"])}
                className="flex-1 px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {MATCHER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newMatcherValue}
                onChange={(e) => setNewMatcherValue(e.target.value)}
                placeholder="e.g. timestamp"
                className="flex-1 px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent font-mono placeholder:text-muted"
              />
            </div>
            <select
              value={newPreset}
              onChange={(e) => setNewPreset(e.target.value as FormatterPreset)}
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim() || !newMatcherValue.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
            + Add Custom Formatter
          </Button>
        )}
      </div>
    </Modal>
  );
};
