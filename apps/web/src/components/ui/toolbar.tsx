import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const base =
  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

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
          <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[11px] leading-none">
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
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 320 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Portalled and fixed: the toolbar scrolls horizontally and the grid's
  // sticky header sits at z-30, so an in-flow panel gets clipped or covered.
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw = align === 'right' ? rect.right - width : rect.left;
    setPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(raw, window.innerWidth - width - 8)),
      maxHeight: Math.max(120, Math.min(320, window.innerHeight - rect.bottom - 16)),
    });
  }, [align, width]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReflow = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  return (
    <div className="shrink-0">
      <ToolbarButton
        ref={triggerRef}
        icon={icon}
        badge={badge}
        active={active || open}
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </ToolbarButton>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ width, top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
            className="fixed z-50 overflow-auto rounded-md border border-border bg-bg shadow-xl p-1"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
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
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'text-danger hover:bg-danger/10' : 'text-primary hover:bg-bg-secondary'
      }`}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted">{children}</div>;
}
