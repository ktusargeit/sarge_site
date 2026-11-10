import React, { useState } from 'react';

interface SargeExpoSectionProps {
  onShowToast: (msg: string) => void;
}

export const SargeExpoSection: React.FC<SargeExpoSectionProps> = () => {
  const [loading, setLoading] = useState(true);

  return (
    <div className="w-full bg-[#09090b] relative flex flex-col min-h-[calc(100vh-80px)]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#09090b] text-zinc-400 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">SARGE EXPO Yükleniyor...</span>
          </div>
        </div>
      )}
      <iframe
        src="/expo-content.html"
        title="SARGE EXPO"
        className="w-full flex-1 border-0"
        style={{ width: '100%', height: 'calc(100vh - 80px)', minHeight: '900px', display: 'block' }}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
};
