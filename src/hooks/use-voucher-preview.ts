'use client';

import { useState, useCallback } from 'react';
import type { AssetVoucherPreviewData } from '@/components/assets/asset-voucher-preview-dialog';

interface UseVoucherPreviewOptions {
  onConfirm?: (vouchers: AssetVoucherPreviewData[]) => Promise<void>;
  validate?: () => boolean | string;
}

interface UseVoucherPreviewReturn {
  showPreview: boolean;
  previewVouchers: AssetVoucherPreviewData[];
  isProcessing: boolean;
  openPreview: (vouchers: AssetVoucherPreviewData[]) => void;
  closePreview: () => void;
  handleConfirm: (vouchers: AssetVoucherPreviewData[]) => Promise<void>;
  setShowPreview: (show: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
}

export function useVoucherPreview(options: UseVoucherPreviewOptions = {}): UseVoucherPreviewReturn {
  const { onConfirm, validate } = options;

  const [showPreview, setShowPreview] = useState(false);
  const [previewVouchers, setPreviewVouchers] = useState<AssetVoucherPreviewData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const openPreview = useCallback((vouchers: AssetVoucherPreviewData[]) => {
    if (validate) {
      const result = validate();
      if (result === false) return;
      if (typeof result === 'string') {
        return;
      }
    }
    setPreviewVouchers(vouchers);
    setShowPreview(true);
  }, [validate]);

  const closePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  const handleConfirm = useCallback(async (vouchers: AssetVoucherPreviewData[]) => {
    if (!onConfirm) return;

    setIsProcessing(true);
    try {
      await onConfirm(vouchers);
      setShowPreview(false);
    } finally {
      setIsProcessing(false);
    }
  }, [onConfirm]);

  return {
    showPreview,
    previewVouchers,
    isProcessing,
    openPreview,
    closePreview,
    handleConfirm,
    setShowPreview,
    setIsProcessing,
  };
}
