import { useCallback, useMemo } from "react";
import type {
  QueryTemplate,
  ColumnFormatter,
  PluginConfig,
  FormatterPreset,
  FormatterMatcher,
} from "@/lib/plugin-types";
import { DEFAULT_TEMPLATES, DEFAULT_FORMATTERS } from "@/lib/default-plugins";
import { persistentStore, usePersistentStore } from "@/lib/persistent-store";

const STORAGE_KEY = "dbview-plugins";

const EMPTY_CONFIG: PluginConfig = { templates: [], formatters: [], disabledBuiltIns: [] };

// Read by the dashboard, settings modal, and template browser at once.
const store = persistentStore<PluginConfig>(STORAGE_KEY, EMPTY_CONFIG, (raw) => {
  const c = raw as Partial<PluginConfig> | null;
  if (!c || typeof c !== "object") return EMPTY_CONFIG;
  return {
    templates: Array.isArray(c.templates) ? c.templates : [],
    formatters: Array.isArray(c.formatters) ? c.formatters : [],
    disabledBuiltIns: Array.isArray(c.disabledBuiltIns) ? c.disabledBuiltIns : [],
  };
});

export function usePlugins() {
  const config = usePersistentStore(store);

  const updateConfig = useCallback((updater: (prev: PluginConfig) => PluginConfig) => {
    store.set(updater);
  }, []);

  const getTemplates = useCallback(
    (dialect: "postgresql" | "mysql" | "sqlite"): QueryTemplate[] => {
      const builtIn = DEFAULT_TEMPLATES.filter(
        (t) =>
          (t.dialect === dialect || t.dialect === "universal") &&
          !config.disabledBuiltIns.includes(t.id)
      );
      const custom = config.templates.filter(
        (t) => t.dialect === dialect || t.dialect === "universal"
      );
      return [...builtIn, ...custom];
    },
    [config.disabledBuiltIns, config.templates]
  );

  const getFormatters = useCallback((): ColumnFormatter[] => {
    const builtIn = DEFAULT_FORMATTERS.filter(
      (f) => !config.disabledBuiltIns.includes(f.id)
    );
    return [...builtIn, ...config.formatters];
  }, [config.disabledBuiltIns, config.formatters]);

  const addTemplate = useCallback(
    (template: Omit<QueryTemplate, "id" | "isBuiltIn">) => {
      updateConfig((prev) => ({
        ...prev,
        templates: [
          ...prev.templates,
          { ...template, id: `custom_tpl_${Date.now()}`, isBuiltIn: false },
        ],
      }));
    },
    [updateConfig]
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      updateConfig((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== id),
      }));
    },
    [updateConfig]
  );

  const addFormatter = useCallback(
    (formatter: {
      name: string;
      description: string;
      matcher: FormatterMatcher;
      preset: FormatterPreset;
    }) => {
      updateConfig((prev) => ({
        ...prev,
        formatters: [
          ...prev.formatters,
          { ...formatter, id: `custom_fmt_${Date.now()}`, isBuiltIn: false },
        ],
      }));
    },
    [updateConfig]
  );

  const deleteFormatter = useCallback(
    (id: string) => {
      updateConfig((prev) => ({
        ...prev,
        formatters: prev.formatters.filter((f) => f.id !== id),
      }));
    },
    [updateConfig]
  );

  const toggleBuiltIn = useCallback(
    (id: string) => {
      updateConfig((prev) => {
        const disabled = prev.disabledBuiltIns.includes(id)
          ? prev.disabledBuiltIns.filter((d) => d !== id)
          : [...prev.disabledBuiltIns, id];
        return { ...prev, disabledBuiltIns: disabled };
      });
    },
    [updateConfig]
  );

  const resolveTemplate = useCallback(
    (template: QueryTemplate, variables: Record<string, string>): string => {
      let sql = template.sql;
      for (const v of template.variables) {
        const value = variables[v.name] || v.defaultValue || "";
        sql = sql.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), value);
      }
      return sql;
    },
    []
  );

  const allFormatters = useMemo(() => getFormatters(), [getFormatters]);

  return {
    config,
    getTemplates,
    getFormatters,
    allFormatters,
    addTemplate,
    deleteTemplate,
    addFormatter,
    deleteFormatter,
    toggleBuiltIn,
    resolveTemplate,
  };
}
