import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SuccessToastProps {
  message: string | null;
  onClose: () => void;
}


export const SuccessToast: React.FC<SuccessToastProps> = ({ message, onClose }) => {
  const isError = message?.toLowerCase().includes('başarısız') || message?.toLowerCase().includes('hata');

  useEffect(() => {

    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className={`fixed bottom-6 right-6 z-50 max-w-md w-full bg-[#18181b] border rounded-2xl shadow-2xl p-4 flex items-start gap-3 backdrop-blur-lg ${isError ? 'border-red-500/50' : 'border-[#27272a]'}`}
        >
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${isError ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-white/10 text-white border-white/20'}`}>
            {isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>

          <div className="flex-1 space-y-1">
            <h4 className={`text-xs font-bold font-sans uppercase tracking-wider ${isError ? 'text-red-400' : 'text-white'}`}>
              {isError ? 'İşlem Başarısız' : 'İşlem Başarılı'}
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed">
              {message}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
