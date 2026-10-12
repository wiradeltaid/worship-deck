import React, { useMemo } from 'react';
import { generateQrCode } from '@/lib/qrcode';

export interface QRCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
  quietZone?: number;
}

export function QRCodeSvg({
  value,
  size = 180,
  className = '',
  quietZone = 4,
}: QRCodeSvgProps) {
  const qr = useMemo(() => {
    try {
      return generateQrCode(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) {
    return (
      <div
        data-testid="remote-qr-code"
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-muted text-xs text-muted-foreground p-2 text-center rounded border border-border ${className}`}
      >
        QR Generation Error
      </div>
    );
  }

  const moduleCount = qr.size;
  const viewBoxSize = moduleCount + quietZone * 2;

  // Build path definition for black squares to keep DOM lightweight
  const pathParts: string[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.modules[r][c]) {
        const x = c + quietZone;
        const y = r + quietZone;
        pathParts.push(`M${x},${y}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      data-testid="remote-qr-code"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={`bg-white rounded ${className}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR Code"
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      <path d={pathParts.join(' ')} fill="#000000" />
    </svg>
  );
}

export default QRCodeSvg;
