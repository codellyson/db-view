import React from 'react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  cn,
} from '@codellyson/justui/react';

export function ToolbarDivider() {
  return <Separator orientation="vertical" className="h-5 mx-1 shrink-0" />;
}

// Must forward the ref and spread the rest: `DropdownMenuTrigger asChild`
// clones this with its own handlers and aria/data attributes, and dropping
// them leaves a trigger that never opens.
interface ToolbarButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  icon?: React.ReactNode;
  active?: boolean;
  variant?: 'default' | 'accent';
  badge?: number;
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    { children, icon, active, variant = 'default', badge, className, ...rest },
    ref
  ) {
    return (
      <Button
        ref={ref}
        variant={variant === 'accent' ? 'primary' : 'ghost'}
        size="sm"
        className={cn(
          'gap-1.5 px-2.5 text-sm',
          active && variant !== 'accent' && 'bg-bg-secondary text-primary',
          className
        )}
        {...rest}
      >
        {icon}
        {children}
        {badge != null && badge > 0 && (
          <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[11px] leading-none">{badge}</Badge>
        )}
      </Button>
    );
  }
);

interface ToolbarMenuProps {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  align?: 'left' | 'right';
  width?: number;
  children: React.ReactNode;
}

export function ToolbarMenu({
  label,
  icon,
  badge,
  active,
  disabled,
  title,
  align = 'left',
  width = 240,
  children,
}: ToolbarMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          icon={icon}
          badge={badge}
          active={active}
          disabled={disabled}
          title={title}
          className="shrink-0"
        >
          {label}
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align === 'right' ? 'end' : 'start'}
        style={{ width }}
        className="max-h-80 overflow-auto"
        collisionPadding={8}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuItem({
  children,
  onClick,
  disabled,
  danger,
  onSelect,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Pass `(e) => e.preventDefault()` to keep the menu open after choosing. */
  onSelect?: (event: Event) => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      onSelect={onSelect}
      disabled={disabled}
      className={cn('gap-2 text-sm', danger && 'text-danger focus:text-danger')}
    >
      {children}
    </DropdownMenuItem>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted font-normal">
      {children}
    </DropdownMenuLabel>
  );
}

export { DropdownMenuSeparator as MenuSeparator };
