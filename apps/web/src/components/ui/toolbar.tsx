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
  triggerClassName?: string;
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
  triggerClassName,
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
          className={cn('shrink-0', triggerClassName)}
        >
          {label}
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align === 'right' ? 'end' : 'start'}
        style={{ width }}
        className="max-h-80 overflow-auto origin-top animate-menu-in"
        collisionPadding={8}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A related run of controls: tight internal spacing, one shared outline. */
export function ToolbarGroup({
  children,
  bordered,
  className,
}: {
  children: React.ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center shrink-0',
        bordered ? 'gap-0 rounded-md border border-border h-8 px-0.5' : 'gap-0.5',
        className
      )}
    >
      {children}
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
}

/** Track-and-thumb switch, so the view choice doesn't read as two buttons. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex items-center gap-0.5 h-8 p-0.5 rounded-md bg-bg-secondary shrink-0">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={cn(
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-sm font-medium transition-all',
              selected
                ? 'bg-bg text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
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
