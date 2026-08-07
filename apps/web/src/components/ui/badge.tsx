import React from 'react';
import { Badge as JustBadge, cn } from '@codellyson/justui/react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
}

// The app's badges are tinted rather than solid, so the palette rides on
// className over JustUI's outline variant.
const TINT = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-accent/10 text-accent',
} as const;

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', children, className }) => (
  <JustBadge
    variant="outline"
    className={cn('border-transparent px-2 py-0.5 font-medium', TINT[variant], className)}
  >
    {children}
  </JustBadge>
);
