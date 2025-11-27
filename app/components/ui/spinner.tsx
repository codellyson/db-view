import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`font-mono font-bold uppercase text-black ${sizeStyles[size]} ${className}`}>
      <span className="animate-pulse">LOADING...</span>
    </div>
  );
};

