'use client';

import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Printer, Download, QrCode } from 'lucide-react';
import type { FixedAsset } from '@/types';

interface AssetQRLabelProps {
  asset: FixedAsset;
  size?: number;
  showBatch?: boolean;
  batchIndex?: number; // 当前序号（1-based）
}

interface QRLabelData {
  assetCode: string;
  assetName: string;
  specification?: string;
  acquisitionDate: string;
  departmentName?: string;
  assignedUser?: string;
  location?: string;
}

export function AssetQRLabel({ asset, size = 128, showBatch = false, batchIndex = 1 }: AssetQRLabelProps) {
  const labelData: QRLabelData = {
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    specification: asset.specification,
    acquisitionDate: asset.acquisitionDate,
    departmentName: asset.departmentName,
    assignedUser: asset.assignedUser,
    location: asset.location,
  };

  const qrValue = JSON.stringify(labelData);

  // 批次格式：FA0001 1/10（如果有数量）
  const batchDisplay = showBatch && asset.quantity > 1
    ? `${asset.assetCode} ${batchIndex}/${asset.quantity}`
    : asset.assetCode;

  return (
    <div className="flex flex-col items-center p-2 bg-white border border-slate-200 rounded print:border-none">
      <QRCodeSVG value={qrValue} size={size} level="M" />
      <div className="mt-1 text-xs font-mono text-slate-600">{batchDisplay}</div>
    </div>
  );
}

interface AssetQRLabelPrintProps {
  asset: FixedAsset;
  trigger?: React.ReactNode;
  showBatch?: boolean; // 是否显示批次格式
}

export function AssetQRLabelPrint({ asset, trigger, showBatch = false }: AssetQRLabelPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // 批次格式显示
  const batchDisplay = showBatch && asset.quantity > 1
    ? `${asset.assetCode} 1/${asset.quantity}`
    : asset.assetCode;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>资产标签 - ${batchDisplay}</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .label-container {
            width: 80mm;
            height: 50mm;
            border: 1px solid #000;
            padding: 5mm;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            gap: 5mm;
            page-break-after: always;
          }
          .qr-section {
            flex-shrink: 0;
          }
          .info-section {
            flex: 1;
            font-size: 10pt;
            line-height: 1.4;
          }
          .asset-code {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .asset-name {
            font-size: 11pt;
            margin-bottom: 2mm;
          }
          .detail {
            font-size: 9pt;
            color: #333;
          }
          @media print {
            body { margin: 0; }
            .label-container { border: 1px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="qr-section">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="80" height="80">
              ${new XMLSerializer().serializeToString(
                document.createElementNS('http://www.w3.org/2000/svg', 'svg')
              )}
            </svg>
          </div>
          <div class="info-section">
            <div class="asset-code">${batchDisplay}</div>
            <div class="asset-name">${asset.assetName}</div>
            ${asset.specification ? `<div class="detail">规格: ${asset.specification}</div>` : ''}
            <div class="detail">入账: ${asset.acquisitionDate}</div>
            ${asset.quantity > 1 ? `<div class="detail">数量: ${asset.quantity}${asset.unit || '台'}</div>` : ''}
            ${asset.departmentName ? `<div class="detail">部门: ${asset.departmentName}</div>` : ''}
            ${asset.assignedUser ? `<div class="detail">使用人: ${asset.assignedUser}</div>` : ''}
            ${asset.location ? `<div class="detail">位置: ${asset.location}</div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `);

    // 生成 QR 码 SVG
    const qrContainer = printWindow.document.querySelector('.qr-section');
    if (qrContainer) {
      const qrData = JSON.stringify({
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        specification: asset.specification,
        acquisitionDate: asset.acquisitionDate,
      });
      qrContainer.innerHTML = '';
      // 使用 canvas 绘制 QR 码
      const canvas = printWindow.document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 80;
      qrContainer.appendChild(canvas);
    }

    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    const svg = printRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.fillRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 0, 0);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `资产标签_${asset.assetCode}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-1" />
            标签
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>资产标签</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="flex justify-center p-4 bg-white border rounded-lg">
          <div className="flex items-center gap-4 p-3 border-2 border-dashed border-slate-300 rounded">
            <AssetQRLabel asset={asset} size={100} />
            <div className="text-sm space-y-1">
              <div className="font-bold text-slate-900">{asset.assetCode}</div>
              <div className="text-slate-700">{asset.assetName}</div>
              {asset.specification && (
                <div className="text-slate-500 text-xs">规格: {asset.specification}</div>
              )}
              <div className="text-slate-500 text-xs">入账: {asset.acquisitionDate}</div>
              {asset.departmentName && (
                <div className="text-slate-500 text-xs">部门: {asset.departmentName}</div>
              )}
              {asset.assignedUser && (
                <div className="text-slate-500 text-xs">使用人: {asset.assignedUser}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            下载
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            打印
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AssetQRLabelBatchProps {
  assets: FixedAsset[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AssetQRLabelBatch({ assets, trigger, open: externalOpen, onOpenChange: externalOnOpenChange }: AssetQRLabelBatchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  // 展开批量资产：数量>1的资产生成多个标签
  const expandedLabels = assets.flatMap(asset => {
    if (asset.quantity > 1) {
      return Array.from({ length: asset.quantity }, (_, i) => ({
        asset,
        batchIndex: i + 1,
        isBatch: true,
      }));
    }
    return [{ asset, batchIndex: 1, isBatch: false }];
  });

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelsHtml = expandedLabels.map(({ asset, batchIndex, isBatch }) => {
      const batchDisplay = isBatch
        ? `${asset.assetCode} ${batchIndex}/${asset.quantity}`
        : asset.assetCode;

      return `
        <div class="label-container">
          <div class="qr-placeholder" data-code="${asset.assetCode}" data-name="${asset.assetName}" data-spec="${asset.specification || ''}" data-date="${asset.acquisitionDate}" data-batch="${batchDisplay}"></div>
          <div class="info-section">
            <div class="asset-code">${batchDisplay}</div>
            <div class="asset-name">${asset.assetName}</div>
            ${asset.specification ? `<div class="detail">规格: ${asset.specification}</div>` : ''}
            <div class="detail">入账: ${asset.acquisitionDate}</div>
            ${asset.departmentName ? `<div class="detail">部门: ${asset.departmentName}</div>` : ''}
            ${asset.assignedUser ? `<div class="detail">使用人: ${asset.assignedUser}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>资产标签批量打印</title>
        <style>
          body { margin: 0; padding: 10px; font-family: sans-serif; }
          .label-container {
            width: 80mm;
            height: 50mm;
            border: 1px solid #000;
            padding: 5mm;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            gap: 5mm;
            margin-bottom: 5mm;
            page-break-inside: avoid;
          }
          .qr-placeholder { width: 80px; height: 80px; background: #f0f0f0; }
          .info-section { flex: 1; font-size: 10pt; line-height: 1.4; }
          .asset-code { font-size: 12pt; font-weight: bold; margin-bottom: 2mm; }
          .asset-name { font-size: 11pt; margin-bottom: 2mm; }
          .detail { font-size: 9pt; color: #333; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${labelsHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <QrCode className="h-4 w-4 mr-1" />
              批量打印标签
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>批量打印资产标签 ({expandedLabels.length} 个标签，{assets.length} 种资产)</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 max-h-[60vh] overflow-auto">
          {expandedLabels.map(({ asset, batchIndex, isBatch }) => (
            <div key={`${asset.id}-${batchIndex}`} className="flex items-center gap-2 p-2 border rounded bg-white">
              <AssetQRLabel asset={asset} size={64} showBatch={isBatch} batchIndex={batchIndex} />
              <div className="text-xs min-w-0">
                <div className="font-medium font-mono">
                  {isBatch ? `${asset.assetCode} ${batchIndex}/${asset.quantity}` : asset.assetCode}
                </div>
                <div className="text-slate-600 truncate">{asset.assetName}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handlePrintAll}>
            <Printer className="h-4 w-4 mr-1" />
            打印全部
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AssetQRLabel;
