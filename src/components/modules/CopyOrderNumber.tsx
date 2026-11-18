'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyOrderNumberProps {
  /** The order number as stored (Latin digits). It is never converted to Persian digits, so customers can copy it exactly. */
  value: string;
  className?: string;
}

/** Shows an order number left-to-right in Latin digits, with a copy button (44px touch target). */
export const CopyOrderNumber: React.FC<CopyOrderNumberProps> = ({ value, className = '' }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard unavailable (permissions or insecure context): the number stays visible for manual copying.
      setCopied(false);
    }
  };

  return (
    <span dir="ltr" className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-mono font-black break-all">{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'شماره فاکتور کپی شد' : 'کپی شماره فاکتور'}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-farm-border bg-white px-2 text-xs font-bold text-farm-primary hover:bg-farm-bg"
      >
        {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'شماره فاکتور کپی شد' : ''}
      </span>
    </span>
  );
};
