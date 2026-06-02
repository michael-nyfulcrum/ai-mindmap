import { createPortal } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { Spinner } from "./ui/Spinner";
import { useToasts, type Toast, type ToastStatus } from "./toast";

export function ToastHost() {
  const items = useToasts();
  if (items.length === 0) {
    return null;
  }
  return createPortal(
    <div className="toast-host" aria-live="polite">
      {items.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast: item }: { toast: Toast }) {
  return (
    <div className={`toast toast-${item.status}`} role="status">
      <span className="toast-orb">{statusIcon(item.status)}</span>
      <div className="toast-body">
        <span className="toast-message">{item.message}</span>
        {item.detail ? <span className="toast-detail">{item.detail}</span> : null}
      </div>
    </div>
  );
}

function statusIcon(status: ToastStatus) {
  if (status === "loading") {
    return <Spinner size={16} />;
  }
  if (status === "success") {
    return <Check size={15} />;
  }
  return <TriangleAlert size={15} />;
}
