"use client";

import React from "react";
import { ActiveQueriesCard } from "./active-queries-card";
import { SlowQueriesCard } from "./slow-queries-card";
import { ConnectionPoolCard } from "./connection-pool-card";
import { TableBloatCard } from "./table-bloat-card";

interface PerformanceDashboardProps {
  schema: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  schema,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActiveQueriesCard enabled />
        <ConnectionPoolCard enabled />
      </div>
      <SlowQueriesCard enabled />
      <TableBloatCard enabled schema={schema} />
    </div>
  );
};
