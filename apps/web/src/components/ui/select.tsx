import React from "react";

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  // Layout/width classes go on the wrapper (it owns the chevron position),
  // e.g. "flex-1" or "w-40". Defaults to full width.
  containerClassName?: string;
  // sm matches `py-1.5` inputs (the app default); md matches `py-2` inputs.
  inputSize?: "sm" | "md";
}

const SIZE: Record<NonNullable<SelectProps["inputSize"]>, string> = {
  sm: "py-1.5 text-sm",
  md: "py-2 text-sm",
};

// Native <select> renders taller than a text input at the same padding because
// the browser draws its own dropdown chrome. `appearance-none` strips that so
// the box sizes from padding like an input; we draw our own chevron. This is
// the one place select styling lives so every dropdown matches the inputs.
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", containerClassName = "w-full", inputSize = "sm", children, ...props }, ref) => (
    <div className={`relative ${containerClassName}`}>
      <select
        ref={ref}
        className={`w-full appearance-none rounded-md border border-border bg-bg pl-2.5 pr-8 text-primary focus:outline-none focus:ring-2 focus:ring-accent ${SIZE[inputSize]} ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  ),
);

Select.displayName = "Select";
