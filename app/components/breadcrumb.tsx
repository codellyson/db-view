import React from 'react';

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
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm font-bold uppercase font-mono text-black dark:text-white">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-black/40 dark:text-white/40" aria-hidden="true">
                  &gt;
                </span>
              )}
              {isLast || !item.onClick ? (
                <span className={isLast ? 'text-black dark:text-white' : 'text-black/60 dark:text-white/60'}>
                  {item.label}
                </span>
              ) : (
                <button
                  onClick={item.onClick}
                  className="text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white underline underline-offset-4"
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
