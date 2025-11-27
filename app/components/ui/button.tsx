import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'border-2 border-black rounded-none font-mono uppercase font-bold focus:outline-none focus:shadow-[0_0_0_2px_black] disabled:opacity-25 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-white text-black hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5',
    secondary: 'bg-white text-black hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5',
    danger: 'bg-white text-black border-red-500 hover:bg-red-500 hover:text-white active:translate-x-0.5 active:translate-y-0.5',
    ghost: 'bg-white text-black border-black hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5',
  };
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-8 py-4 text-base',
    lg: 'px-12 py-6 text-lg',
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">LOADING...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

