"use client";

import { ComponentPropsWithoutRef, useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

type PasswordFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  label: string;
  wrapperClassName?: string;
};

export function PasswordField({ label, wrapperClassName = "", className = "", id, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <label className={`field-label ${wrapperClassName}`.trim()} htmlFor={inputId}>
      {label}
      <div className="relative mt-2">
        <input
          {...props}
          id={inputId}
          className={`input pr-12 ${className}`.trim()}
          type={visible ? "text" : "password"}
        />
        <button
          type="button"
          className="absolute inset-y-1 right-1 flex min-w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
    </label>
  );
}
