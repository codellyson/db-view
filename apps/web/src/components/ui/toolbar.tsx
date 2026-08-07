import React, { useEffect, useRef, useState } from 'react';

const base =
  'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" aria-hidden />;
}

interface ToolbarButtonProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  variant?: 'default' | 'accent';
  badge?: number;
  'aria-label'?: string;
}

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    { children, icon, onClick, active, disabled, title, variant = 'default', badge, ...rest },
    ref
  ) {
    const tone =
      variant === 'accent'
        ? 'bg-accent text-white hover:bg-accent-hover'
        : active
          ? 'bg-bg-secondary text-primary'
          : 'text-secondary hover:text-primary hover:bg-bg-secondary';
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={rest['aria-label']}
        className={`${base} ${tone}`}
      >
        {icon}
        {children}
        {badge != null && badge > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] leading-none">
            {badge}
          </span>
        )}
      </button>
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
  children: (close: () => void) => React.ReactNode;
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <ToolbarButton
        icon={icon}
        badge={badge}
        active={active || open}
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </ToolbarButton>
      {open && (
        <div
          style={{ width }}
          className={`absolute z-40 mt-1 max-h-80 overflow-auto rounded-md border border-border bg-bg shadow-lg p-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'text-danger hover:bg-danger/10' : 'text-primary hover:bg-bg-secondary'
      }`}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted">{children}</div>;
}
