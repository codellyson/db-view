import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-2 sm:mb-4">
      <ol className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm overflow-x-auto">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5 min-w-0">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
              )}
              {isLast || !item.onClick ? (
                <span
                  title={item.label}
                  className={`truncate max-w-[18rem] ${isLast ? 'font-medium text-primary' : 'text-muted'}`}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  onClick={item.onClick}
                  title={item.label}
                  className="truncate max-w-[18rem] text-secondary hover:text-primary transition-colors"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
