type ToastType = 'success' | 'error';
type ToastListener = (message: string, type: ToastType) => void;

let listener: ToastListener | null = null;

export function setToastListener(fn: ToastListener) {
  listener = fn;
}

export function toast(message: string, type: ToastType = 'success') {
  listener?.(message, type);
}
