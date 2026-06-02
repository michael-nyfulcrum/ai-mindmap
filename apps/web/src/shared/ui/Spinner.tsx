type SpinnerProps = {
  size?: number;
  className?: string;
};

export function Spinner({ size = 14, className = "" }: SpinnerProps) {
  return (
    <span
      className={`spinner ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
