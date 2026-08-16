import React from 'react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value, size = 180 }) => {
  const encodedValue = encodeURIComponent(value);
  // High contrast: Black modules (#000000) on crisp white background (#FFFFFF)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedValue}&color=000000&bgcolor=ffffff&margin=1`;

  return (
    <div className="relative flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white shadow-2xl shadow-emerald-500/10 border-2 border-emerald-500/40">
      <img
        src={qrUrl}
        alt="WhatsApp Login QR Code"
        width={size}
        height={size}
        className="rounded-xl transition-all duration-300 block"
        loading="eager"
      />
    </div>
  );
};
