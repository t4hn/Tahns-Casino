import React, { useState, useEffect } from 'react';
import { X, Check, User } from 'lucide-react';
import { useCasino } from '../context/CasinoContext';
import { AVATAR_OPTIONS } from '../data/initialData';
import { soundManager } from '../utils/sound';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile } = useCasino();
  const [name, setName] = useState(profile?.name || 'Tahn');
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatarUrl || AVATAR_OPTIONS[0].url);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setSelectedAvatar(profile.avatarUrl);
    }
  }, [profile, isOpen]);

  if (!isOpen || !profile) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile(name.trim(), selectedAvatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0f141d] border border-slate-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <User size={18} className="text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-100">Edit Patron Profile</h3>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] -mr-2 text-slate-400 hover:text-slate-200 flex items-center justify-center rounded-lg hover:bg-slate-800/60"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-1.5">
              Patron Name
            </label>
            <input
              type="text"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder="Enter patron name"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-medium mb-2.5">
              Select Patron Avatar
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {AVATAR_OPTIONS.map((avatar) => {
                const isSelected = selectedAvatar === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedAvatar(avatar.url);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all p-0.5 ${
                      isSelected
                        ? 'border-emerald-400 ring-2 ring-emerald-500/20 scale-102'
                        : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={avatar.url}
                      alt={avatar.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xs">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm shadow-emerald-500/20 transition-all min-h-[44px] cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
