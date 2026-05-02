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
import { Printer, QrCode } from 'lucide-react';
import type { FixedAsset } from '@/types';

interface AssetQRLabelProps {
  asset: FixedAsset;
  showBatch?: boolean;
  batchIndex?: number;
}

interface QRLabelData {
  assetCode: string;
  assetName: string;
  specification?: string;
  acquisitionDate: string;
}

/**
 * 资产标签组件 - 紧凑型设计（带QR码）
 * 高度约12mm，适合热敏打印
 */
export function AssetQRLabel({ asset, showBatch = false, batchIndex = 1 }: AssetQRLabelProps) {
  const labelData: QRLabelData = {
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    specification: asset.specification,
    acquisitionDate: asset.acquisitionDate,
  };

  const qrValue = JSON.stringify(labelData);

  // 批次格式：FA0001 1/10
  const batchDisplay = showBatch && asset.quantity > 1
    ? `${asset.assetCode} ${batchIndex}/${asset.quantity}`
    : asset.assetCode;

  // 规格信息
  const specDisplay = asset.specification || asset.assetName;

  return (
    <div className="flex items-center gap-2 bg-white p-1">
      {/* QR码 - 紧凑尺寸 */}
      <QRCodeSVG value={qrValue} size={32} level="M" />

      {/* 右侧信息 */}
      <div className="flex flex-col min-w-0">
        {/* 资产编号 */}
        <div className="font-mono text-xs font-bold tracking-wide">{batchDisplay}</div>
        {/* 分隔线 */}
        <div className="h-px bg-black my-0.5" />
        {/* 规格 */}
        <div className="text-[8px] text-black truncate max-w-[80px]">{specDisplay}</div>
      </div>
    </div>
  );
}

interface AssetQRLabelPrintProps {
  asset: FixedAsset;
  trigger?: React.ReactNode;
  showBatch?: boolean;
}

export function AssetQRLabelPrint({ asset, trigger, showBatch = false }: AssetQRLabelPrintProps) {
  const [open, setOpen] = useState(false);

  const batchDisplay = showBatch && asset.quantity > 1
    ? `${asset.assetCode} 1/${asset.quantity}`
    : asset.assetCode;

  const specDisplay = asset.specification || asset.assetName;

  const labelData: QRLabelData = {
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    specification: asset.specification,
    acquisitionDate: asset.acquisitionDate,
  };
  const qrValue = JSON.stringify(labelData);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>资产标签 - ${batchDisplay}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
          }
          .label-container {
            width: 50mm;
            height: 12mm;
            padding: 1mm;
            display: flex;
            align-items: center;
            gap: 1.5mm;
            background: white;
          }
          .qr-section {
            flex-shrink: 0;
            width: 10mm;
            height: 10mm;
          }
          .qr-section svg {
            width: 100%;
            height: 100%;
          }
          .info-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
          }
          .asset-code {
            font-family: 'Courier New', Courier, monospace;
            font-size: 9pt;
            font-weight: bold;
            line-height: 1.1;
            color: #000;
            letter-spacing: 0.3mm;
          }
          .divider {
            height: 0.5px;
            background: #000;
            margin: 0.5mm 0;
          }
          .spec-info {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 6pt;
            line-height: 1.1;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .label-container { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="qr-section" id="qr-placeholder"></div>
          <div class="info-section">
            <div class="asset-code">${batchDisplay}</div>
            <div class="divider"></div>
            <div class="spec-info">${specDisplay}</div>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
        <script>
          (function() {
            var qr = qrcode(0, 'M');
            qr.addData('${qrValue}');
            qr.make();
            document.getElementById('qr-placeholder').innerHTML = qr.createSvgTag({ cellSize: 2, margin: 0 });
          })();
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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

        {/* 预览区域 */}
        <div className="flex justify-center p-4 bg-white border rounded-lg">
          <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-sm">
            {/* QR码预览 */}
            <QRCodeSVG value={qrValue} size={40} level="M" />
            {/* 右侧信息 */}
            <div className="flex flex-col min-w-0">
              <div className="font-mono text-sm font-bold tracking-wide">{batchDisplay}</div>
              <div className="h-px bg-black my-0.5" />
              <div className="text-[10px] text-black truncate max-w-[100px]">{specDisplay}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
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

    // 生成所有标签的数据
    const labelsData = expandedLabels.map(({ asset, batchIndex, isBatch }) => {
      const batchDisplay = isBatch
        ? `${asset.assetCode} ${batchIndex}/${asset.quantity}`
        : asset.assetCode;
      const specDisplay = asset.specification || asset.assetName;
      const qrValue = JSON.stringify({
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        specification: asset.specification,
        acquisitionDate: asset.acquisitionDate,
      });

      return { batchDisplay, specDisplay, qrValue };
    });

    const labelsHtml = labelsData.map(({ batchDisplay, specDisplay }) => `
      <div class="label-container">
        <div class="qr-placeholder" data-qr="${batchDisplay}"></div>
        <div class="info-section">
          <div class="asset-code">${batchDisplay}</div>
          <div class="divider"></div>
          <div class="spec-info">${specDisplay}</div>
        </div>
      </div>
    `).join('');

    // 生成 QR 数据脚本
    const qrDataScript = labelsData.map(({ qrValue }, idx) =>
      `qrData[${idx}] = '${qrValue}';`
    ).join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>资产标签批量打印</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
          }
          .label-container {
            width: 50mm;
            height: 12mm;
            padding: 1mm;
            display: flex;
            align-items: center;
            gap: 1.5mm;
            background: white;
            page-break-inside: avoid;
          }
          .qr-section {
            flex-shrink: 0;
            width: 10mm;
            height: 10mm;
          }
          .qr-section svg {
            width: 100%;
            height: 100%;
          }
          .info-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
          }
          .asset-code {
            font-family: 'Courier New', Courier, monospace;
            font-size: 9pt;
            font-weight: bold;
            line-height: 1.1;
            color: #000;
            letter-spacing: 0.3mm;
          }
          .divider {
            height: 0.5px;
            background: #000;
            margin: 0.5mm 0;
          }
          .spec-info {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 6pt;
            line-height: 1.1;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .label-container { border: none; }
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
        <script>
          var qrData = [];
          ${qrDataScript}

          var placeholders = document.querySelectorAll('.qr-placeholder');
          placeholders.forEach(function(el, idx) {
            var qr = qrcode(0, 'M');
            qr.addData(qrData[idx]);
            qr.make();
            el.innerHTML = qr.createSvgTag({ cellSize: 2, margin: 0 });
            el.className = 'qr-section';
          });
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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

        {/* 预览网格 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4 max-h-[60vh] overflow-auto">
          {expandedLabels.map(({ asset, batchIndex, isBatch }) => (
            <AssetQRLabel
              key={`${asset.id}-${batchIndex}`}
              asset={asset}
              showBatch={isBatch}
              batchIndex={batchIndex}
            />
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
