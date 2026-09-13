"use client";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={`ui-field ui-control ${className}`}
    />
  );
});
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={`ui-field ui-control ${className}`}
    />
  );
});
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = "", ...props }, ref) {
  return (
    <select
      {...props}
      ref={ref}
      className={`ui-field ui-control ${className}`}
    />
  );
});
export default function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="ui-field-group">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-describedby": hint || error ? `${id}-description` : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {(hint || error) && (
        <p
          id={`${id}-description`}
          className={error ? "ui-field-error" : "ui-field-hint"}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
