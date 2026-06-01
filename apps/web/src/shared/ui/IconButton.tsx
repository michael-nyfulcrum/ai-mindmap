import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
};

export function IconButton({ icon, label, active = false, className = "", ...props }: IconButtonProps) {
  return (
    <button
      className={["icon-button", active && "is-active", className].filter(Boolean).join(" ")}
      type="button"
      title={label}
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  );
}
