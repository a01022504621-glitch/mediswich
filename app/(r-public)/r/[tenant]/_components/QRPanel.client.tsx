"use client";
import { useEffect, useState } from "react";
import * as QRCode from "qrcode";

export default function QRPanel() {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    const url = window.location.origin + window.location.pathname; // /r/[tenant] 포함
    QRCode.toDataURL(url, { margin: 1, width: 180 }).then(setSrc).catch(() => setSrc(""));
  }, []);

  return (
    <div className="flex flex-col items-start">
      <div className="text-sm text-gray-600">QR코드를 스캔해주세요</div>
      <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white p-2">
        {src ? <img src={src} alt="모바일 예약 QR" className="h-44 w-44 object-contain" /> : <div className="h-44 w-44 animate-pulse rounded bg-gray-100" />}
      </div>
    </div>
  );
}

