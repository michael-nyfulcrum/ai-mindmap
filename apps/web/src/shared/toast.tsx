import { useSyncExternalStore } from "react";

export type ToastStatus = "loading" | "success" | "error";

export type Toast = {
  id: string;
  status: ToastStatus;
  message: string;
  detail?: string;
};

const SUCCESS_MS = 2200;
const ERROR_MS = 4200;

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function emit() {
  toasts = [...toasts];
  for (const listener of listeners) {
    listener();
  }
}

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
}

function scheduleDismiss(id: string, ms: number) {
  clearTimer(id);
  timers.set(id, window.setTimeout(() => dismiss(id), ms));
}

function show(status: ToastStatus, message: string, id?: string, detail?: string): string {
  const toastId = id ?? `toast_${++counter}`;
  const existing = toasts.find((toast) => toast.id === toastId);
  if (existing) {
    existing.status = status;
    existing.message = message;
    existing.detail = detail;
  } else {
    toasts.push({ id: toastId, status, message, detail });
  }
  if (status === "success") {
    scheduleDismiss(toastId, SUCCESS_MS);
  } else if (status === "error") {
    scheduleDismiss(toastId, ERROR_MS);
  } else {
    clearTimer(toastId); // loading persists until replaced or dismissed
  }
  emit();
  return toastId;
}

function dismiss(id: string) {
  clearTimer(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  for (const listener of listeners) {
    listener();
  }
}

export const toast = {
  loading: (message: string, id?: string, detail?: string) => show("loading", message, id, detail),
  success: (message: string, id?: string, detail?: string) => show("success", message, id, detail),
  error: (message: string, id?: string, detail?: string) => show("error", message, id, detail),
  dismiss,
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
