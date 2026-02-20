'use client';

import React from 'react';

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Alias'?: string;
  'Startup Cost'?: number;
  'Total Cost'?: number;
  'Plan Rows'?: number;
  'Plan Width'?: number;
  'Actual Startup Time'?: number;
  'Actual Total Time'?: number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Join Type'?: string;
  'Index Name'?: string;
  'Filter'?: string;
  'Index Cond'?: string;
  'Hash Cond'?: string;
  'Sort Key'?: string[];
  Plans?: PlanNode[];
  [key: string]: any;
}

interface ExplainPlanProps {
  plan: any[];
}

export const ExplainPlan: React.FC<ExplainPlanProps> = ({ plan }) => {
  if (!plan || plan.length === 0) return null;

  const rootPlan = plan[0]?.Plan;
  const planningTime = plan[0]?.['Planning Time'];
  const executionTime = plan[0]?.['Execution Time'];

  if (!rootPlan) return null;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs font-bold uppercase font-mono text-black dark:text-white">
        {planningTime !== undefined && (
          <span>PLANNING: {planningTime.toFixed(2)}MS</span>
        )}
        {executionTime !== undefined && (
          <span>EXECUTION: {executionTime.toFixed(2)}MS</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <PlanNodeView node={rootPlan} depth={0} />
      </div>
    </div>
  );
};

const PlanNodeView: React.FC<{ node: PlanNode; depth: number }> = ({ node, depth }) => {
  const nodeType = node['Node Type'];
  const relation = node['Relation Name'];
  const alias = node['Alias'];
  const joinType = node['Join Type'];
  const indexName = node['Index Name'];
  const actualRows = node['Actual Rows'];
  const actualTime = node['Actual Total Time'];
  const planRows = node['Plan Rows'];
  const totalCost = node['Total Cost'];
  const loops = node['Actual Loops'];
  const filter = node['Filter'];
  const indexCond = node['Index Cond'];
  const hashCond = node['Hash Cond'];
  const sortKey = node['Sort Key'];

  const rowAccuracy = planRows && actualRows
    ? Math.abs(actualRows - planRows) / Math.max(planRows, 1)
    : 0;
  const isEstimateOff = rowAccuracy > 1;

  return (
    <div className="space-y-1">
      <div
        className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 font-mono text-sm"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <div className="border-l-4 border-black dark:border-white pl-3 flex flex-wrap items-center gap-x-3 gap-y-1 flex-1">
          <span className="font-bold text-black dark:text-white uppercase">
            {joinType ? `${joinType} ` : ''}{nodeType}
          </span>
          {relation && (
            <span className="text-black/70 dark:text-white/70">
              ON {alias && alias !== relation ? `${relation} AS ${alias}` : relation}
            </span>
          )}
          {indexName && (
            <span className="text-black/60 dark:text-white/60">
              USING {indexName}
            </span>
          )}
        </div>
        <div className="flex gap-3 text-xs flex-shrink-0">
          {actualRows !== undefined && (
            <span className={`${isEstimateOff ? 'text-red-500 font-bold' : 'text-black/60 dark:text-white/60'}`}>
              ROWS: {actualRows}{loops && loops > 1 ? ` x${loops}` : ''}
              {planRows !== undefined && ` (EST: ${planRows})`}
            </span>
          )}
          {actualTime !== undefined && (
            <span className="text-black/60 dark:text-white/60">
              TIME: {actualTime.toFixed(2)}MS
            </span>
          )}
          {totalCost !== undefined && (
            <span className="text-black/60 dark:text-white/60">
              COST: {totalCost.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      {(filter || indexCond || hashCond || sortKey) && (
        <div
          className="text-xs font-mono text-black/50 dark:text-white/50 py-1"
          style={{ paddingLeft: `${depth * 24 + 28}px` }}
        >
          {filter && <div>FILTER: {filter}</div>}
          {indexCond && <div>INDEX COND: {indexCond}</div>}
          {hashCond && <div>HASH COND: {hashCond}</div>}
          {sortKey && <div>SORT KEY: {sortKey.join(', ')}</div>}
        </div>
      )}
      {node.Plans?.map((child, i) => (
        <PlanNodeView key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
};
