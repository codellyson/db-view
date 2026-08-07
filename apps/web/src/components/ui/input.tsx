import React from 'react';
import { Input as JustInput, Label, cn } from '@codellyson/justui/react';

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
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
  className,
  id: providedId,
  ...props
}) => {
  const id = providedId || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={id} className="block mb-1.5">
          {label}
        </Label>
      )}
      <JustInput
        id={id}
        type={props.type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('w-full', error && 'border-danger focus-visible:ring-danger', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
