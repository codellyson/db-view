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
  ...props
}) => {
  const baseStyles =
    "w-full px-4 py-3 border-2 border-black rounded-none font-mono focus:outline-none focus:shadow-[0_0_0_2px_black] bg-white text-black";
  const normalStyles = "border-black focus:border-black";
  const errorStyles =
    "border-2 border-red-500 focus:border-red-500 focus:shadow-[0_0_0_2px_rgb(239,68,68)]";

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-bold uppercase text-black mb-2">
          {label}
        </label>
      )}
      <input
        type={props.type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseStyles} ${
          error ? errorStyles : normalStyles
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-2 text-sm font-bold uppercase text-red-500">{error}</p>
      )}
    </div>
  );
};
