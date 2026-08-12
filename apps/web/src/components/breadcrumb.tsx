import React from 'react';
import { Breadcrumb as JustBreadcrumb, BreadcrumbItem } from '@codellyson/justui/react';

interface Crumb {
  label: string;
  onClick?: () => void;
}

export const Breadcrumb: React.FC<{ items: Crumb[] }> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <JustBreadcrumb className="mb-2 sm:mb-4" maxItems={4}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <BreadcrumbItem
            key={index}
            current={isLast}
            title={item.label}
            onClick={isLast ? undefined : item.onClick}
            className="truncate max-w-[18rem]"
          >
            {item.label}
          </BreadcrumbItem>
        );
      })}
    </JustBreadcrumb>
  );
};
