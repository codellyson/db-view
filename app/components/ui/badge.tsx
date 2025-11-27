import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'info',
  children,
  className = '',
}) => {
  const variantStyles = {
    success: 'bg-green-400 text-black border-green-400',
    warning: 'bg-yellow-300 text-black border-yellow-300',
    danger: 'bg-red-500 text-white border-red-500',
    info: 'bg-white text-black border-black',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 border-2 rounded-none text-xs font-bold uppercase font-mono ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

