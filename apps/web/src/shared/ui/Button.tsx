import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ icon, children, variant = "secondary", className = "", ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}
