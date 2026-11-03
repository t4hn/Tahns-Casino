import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { soundManager } from '../utils/sound';

interface ConfirmResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfirmResetModal: React.FC<ConfirmResetModalProps> = ({ isOpen, onClose }) => {
  const { resetProgress } = useCasino();

  if (!isOpen) return null;

  const handleConfirm = () => {
    resetProgress();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#0f141d] border border-red-500/30 p-6 shadow-2xl">
        <button
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          aria-label="Cancel reset"
          className="absolute top-3.5 right-3.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertTriangle size={28} />
        </div>

        <h3 className="font-display text-lg font-bold text-slate-100 text-center">
          Reset Casino Progress?
        </h3>

        <p className="mt-2 text-xs text-slate-400 text-center leading-relaxed">
          This will wipe your patron profile, credits, XP progression, and achievements from this device, returning you to the character creation screen. This cannot be undone.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 font-medium text-xs transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-md shadow-red-900/30 transition-colors min-h-[44px]"
          >
            Yes, Reset All
          </button>
        </div>
      </div>
    </div>
  );
};
