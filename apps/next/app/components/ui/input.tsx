import React from "react";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  value,
  onChange,
  className = "",
  id: providedId,
  ...props
}) => {
  const id = providedId || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-primary mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        type={props.type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 rounded-md border text-sm text-primary bg-bg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
          error ? "border-danger focus:ring-danger" : "border-border"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-danger">{error}</p>
      )}
    </div>
  );
};
