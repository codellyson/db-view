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
    <div className={`bg-white border-2 border-black rounded-none p-0 ${className}`}>
      {title && (
        <div className="border-b-2 border-black p-4 bg-black">
          <h4 className="text-base font-bold uppercase text-white">{title}</h4>
        </div>
      )}
      <div className="p-8">
        {children}
      </div>
    </div>
  );
};

