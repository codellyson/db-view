import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  className = '',
}) => {
  return (
    <div className={`bg-bg border border-border rounded-lg ${className}`}>
      {title && (
        <div className="border-b border-border px-5 py-3">
          <h4 className="text-sm font-semibold text-primary">{title}</h4>
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  );
};
