import React from 'react';
import { Button as JustButton, cn } from '@codellyson/justui/react';
import { Loader2 } from 'lucide-react';

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
          <Loader2 className="animate-spin h-4 w-4" />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </JustButton>
  );
});
