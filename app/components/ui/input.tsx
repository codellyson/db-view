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

  const baseStyles =
    "w-full px-4 py-3 border-2 border-black dark:border-white rounded-none font-mono focus:outline-none focus:shadow-[0_0_0_2px_black] dark:focus:shadow-[0_0_0_2px_white] bg-white dark:bg-black text-black dark:text-white";
  const normalStyles = "border-black dark:border-white focus:border-black dark:focus:border-white";
  const errorStyles =
    "border-2 border-red-500 focus:border-red-500 focus:shadow-[0_0_0_2px_rgb(239,68,68)]";

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-bold uppercase text-black dark:text-white mb-2">
          {label}
        </label>
      )}
      <input
        id={id}
        type={props.type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseStyles} ${
          error ? errorStyles : normalStyles
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && errorId ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-bold uppercase text-red-500">{error}</p>
      )}
    </div>
  );
};
