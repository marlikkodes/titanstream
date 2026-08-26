import React, { useMemo } from 'react';
import { generateQR } from '../utils/qr-encoder';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a scannable QR code as a pure SVG using our built-in
 * ISO 18004 encoder. Zero network requests, zero npm dependencies.
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 180,
  className = '',
}) => {
  const safeValue = value || 'https://tetherstream.io';

  const matrix = useMemo(() => {
    try {
      return generateQR(safeValue);
    } catch {
      return generateQR('https://tetherstream.io');
    }
  }, [safeValue]);

  const moduleCount = matrix.length;
  const quietZone = 4; // Standard quiet zone
  const totalSize = moduleCount + quietZone * 2;

  // Build a single SVG <path> for all dark modules (fast, minimal DOM)
  const pathData = useMemo(() => {
    let d = '';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          d += `M${c + quietZone},${r + quietZone}h1v1h-1z`;
        }
      }
    }
    return d;
  }, [matrix, moduleCount, quietZone]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white shadow-2xl shadow-emerald-500/10 border-2 border-emerald-500/40 ${className}`}
    >
      <svg
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        width={size}
        height={size}
        className="rounded-xl block"
        shapeRendering="crispEdges"
      >
        <rect width={totalSize} height={totalSize} fill="#FFFFFF" />
        <path d={pathData} fill="#000000" />
      </svg>
    </div>
  );
};
