"use client";

import { X } from "lucide-react";
import { QuickPropertyForm } from "./quick-property-form";

interface QuickPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (propertyId: string) => void;
}

export function QuickPropertyModal({ isOpen, onClose, onSuccess }: QuickPropertyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#1a1d1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all scale-in-center">
        {/* Header with Close Button */}
        <div className="absolute right-6 top-6 z-30">
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2">
            <X size={20} />
          </button>
        </div>

        <QuickPropertyForm 
          onSuccess={onSuccess} 
          onCancel={onClose} 
        />
      </div>
    </div>
  );
}
