import React from 'react';
import { EmptyState as JustEmptyState } from '@codellyson/justui/react';

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
}) => (
  <JustEmptyState icon={icon} title={title} description={description} className="py-16">
    {action}
  </JustEmptyState>
);
