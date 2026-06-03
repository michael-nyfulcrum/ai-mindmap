import { createPortal } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { Spinner } from "./ui/Spinner";
import { toast as toastApi, useToasts, type Toast, type ToastStatus } from "./toast";

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
    <div className={`toast toast-${item.status}`} role="status" onClick={() => toastApi.dismiss(item.id)} title="Dismiss">
      <span className="toast-orb">{statusIcon(item.status)}</span>
      <div className="toast-body">
        <span className="toast-message">{item.message}</span>
        {item.detail ? <span className="toast-detail">{item.detail}</span> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={(event) => {
            event.stopPropagation();
            item.action?.onClick();
            toastApi.dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      ) : null}
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
