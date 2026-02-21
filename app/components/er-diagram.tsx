"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  computeLayout,
  type ERTable,
  type ERRelationship,
} from "@/lib/er-layout";

interface ERDiagramProps {
  tables: ERTable[];
  relationships: ERRelationship[];
}

export const ERDiagram: React.FC<ERDiagramProps> = ({
  tables,
  relationships,
}) => {
  const layout = useMemo(
    () => computeLayout(tables, relationships),
    [tables, relationships]
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: Math.max(layout.width, 800),
    h: Math.max(layout.height, 600),
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        vx: viewBox.x,
        vy: viewBox.y,
      };
    },
    [viewBox.x, viewBox.y]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      const dx = (e.clientX - panStart.current.x) * scaleX;
      const dy = (e.clientY - panStart.current.y) * scaleY;
      setViewBox((prev) => ({
        ...prev,
        x: panStart.current.vx - dx,
        y: panStart.current.vy - dy,
      }));
    },
    [isPanning, viewBox.w, viewBox.h]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
      const my = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
      const newW = viewBox.w * factor;
      const newH = viewBox.h * factor;
      setViewBox({
        x: mx - (mx - viewBox.x) * factor,
        y: my - (my - viewBox.y) * factor,
        w: newW,
        h: newH,
      });
    },
    [viewBox]
  );

  const resetView = useCallback(() => {
    setViewBox({
      x: 0,
      y: 0,
      w: Math.max(layout.width, 800),
      h: Math.max(layout.height, 600),
    });
  }, [layout.width, layout.height]);

  if (tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted">
        No tables found in this schema.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <button
          onClick={() =>
            setViewBox((prev) => ({
              ...prev,
              w: prev.w * 0.8,
              h: prev.h * 0.8,
              x: prev.x + prev.w * 0.1,
              y: prev.y + prev.h * 0.1,
            }))
          }
          className="px-2 py-1 text-xs font-medium bg-bg border border-border rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
        >
          +
        </button>
        <button
          onClick={() =>
            setViewBox((prev) => ({
              ...prev,
              w: prev.w * 1.2,
              h: prev.h * 1.2,
              x: prev.x - prev.w * 0.1,
              y: prev.y - prev.h * 0.1,
            }))
          }
          className="px-2 py-1 text-xs font-medium bg-bg border border-border rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="px-2 py-1 text-xs font-medium bg-bg border border-border rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
        >
          Reset
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              className="fill-accent"
            />
          </marker>
        </defs>

        {/* Relationship lines */}
        {layout.relationships.map((rel, i) => {
          const midX = (rel.from.x + rel.to.x) / 2;
          const d = `M ${rel.from.x} ${rel.from.y} C ${midX} ${rel.from.y}, ${midX} ${rel.to.y}, ${rel.to.x} ${rel.to.y}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              className="stroke-accent"
              strokeWidth="1.5"
              strokeDasharray="none"
              markerEnd="url(#arrowhead)"
              opacity="0.6"
            />
          );
        })}

        {/* Table boxes */}
        {layout.tables.map((table) => (
          <g key={table.name}>
            {/* Table background */}
            <rect
              x={table.x}
              y={table.y}
              width={table.width}
              height={table.height}
              rx="6"
              className="fill-bg stroke-border"
              strokeWidth="1"
            />
            {/* Header background */}
            <rect
              x={table.x}
              y={table.y}
              width={table.width}
              height={36}
              rx="6"
              className="fill-bg-secondary"
            />
            {/* Bottom corners of header need to be square */}
            <rect
              x={table.x}
              y={table.y + 20}
              width={table.width}
              height={16}
              className="fill-bg-secondary"
            />
            {/* Header divider */}
            <line
              x1={table.x}
              y1={table.y + 36}
              x2={table.x + table.width}
              y2={table.y + 36}
              className="stroke-border"
              strokeWidth="1"
            />
            {/* Table name */}
            <text
              x={table.x + 12}
              y={table.y + 23}
              className="fill-primary"
              fontSize="13"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
            >
              {table.name.length > 22
                ? table.name.substring(0, 20) + "..."
                : table.name}
            </text>
            {/* Columns */}
            {table.columns.map((col, ci) => {
              const cy = table.y + 36 + ci * 24 + 16;
              return (
                <g key={col.name}>
                  <text
                    x={table.x + 12}
                    y={cy}
                    className="fill-primary"
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                  >
                    {col.isPrimaryKey ? "\u{1F511} " : ""}
                    {col.name.length > 18
                      ? col.name.substring(0, 16) + "..."
                      : col.name}
                  </text>
                  <text
                    x={table.x + table.width - 10}
                    y={cy}
                    className="fill-muted"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    textAnchor="end"
                  >
                    {col.type.length > 12
                      ? col.type.substring(0, 10) + "..."
                      : col.type}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
};
