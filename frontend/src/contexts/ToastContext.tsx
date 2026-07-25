import { useState, useCallback, ReactNode, createContext, useContext } from 'react';

interface ToastContextType {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((m: string) => {
    setMsg(m);
    setVisible(true);
    window.setTimeout(() => setVisible(false), 1800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && <div className="toast">{msg}</div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
