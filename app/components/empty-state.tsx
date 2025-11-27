import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-black">
      {icon && (
        <div className="text-black mb-8 text-4xl">
          {icon}
        </div>
      )}
      <h3 className="text-2xl font-bold uppercase text-black mb-4">{title}</h3>
      {description && (
        <p className="text-base text-black text-center max-w-md mb-8 font-mono">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

