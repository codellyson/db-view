import React from 'react';
import { Button as JustButton, cn } from '@codellyson/justui/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

// JustUI's `secondary` is filled; this app's has always been outlined.
const VARIANT = {
  primary: 'primary',
  secondary: 'outline',
  danger: 'danger',
  ghost: 'ghost',
} as const;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <JustButton
      ref={ref}
      variant={VARIANT[variant]}
      size={size}
      // JustUI's `sm` drops to text-xs; the app sizes its small buttons at 14px.
      className={cn(size === 'sm' && 'text-sm', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </JustButton>
  );
});
