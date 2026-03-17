'use client';

import { Voucher } from '@/types';
import { toChineseAmount } from './chinese-number';

/**
 * 生成凭证明细打印条目
 */
function buildPrintEntries(voucher: Voucher) {
  // 有效分录
  const validEntries = voucher.entries.filter(e => e.subjectCode || e.debit > 0 || e.credit > 0);
  const printEntries: Array<{ id: string; summary: string; subjectCode: string; subjectName: string; debit: number; credit: number }> = [];
  validEntries.forEach(e => {
    printEntries.push({
      id: e.id,
      summary: e.summary || '',
      subjectCode: e.subjectCode || '',
      subjectName: e.subjectName || '',
      debit: e.debit || 0,
      credit: e.credit || 0
    });
  });

  // 填充到6行
  while (printEntries.length < 6) {
    printEntries.push({
      id: `empty-${printEntries.length}`,
      summary: '',
      subjectCode: '',
      subjectName: '',
      debit: 0,
      credit: 0
    });
  }

  return printEntries;
}

/**
 * 生成单张凭证的打印HTML
 */
export function generateVoucherPrintHtml(voucher: Voucher, accountSetName: string = '未知单位'): string {
  const debitTotal = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const creditTotal = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const chineseAmount = toChineseAmount(debitTotal);
  const [year, month, day] = voucher.date.split('-');

  const printEntries = buildPrintEntries(voucher);

  // 构建表格内容
  let tableRows = '';
  printEntries.slice(0, 6).forEach((entry) => {
    tableRows += `
      <tr>
        <td style="border: 1px solid #000; padding: 8px 10px; height: 48px;">${entry.summary}</td>
        <td style="border: 1px solid #000; padding: 8px 10px; height: 48px;">${entry.subjectCode ? `${entry.subjectCode} ${entry.subjectName}` : ''}</td>
        <td style="border: 1px solid #000; padding: 8px 10px; height: 48px; text-align: right;">${entry.debit > 0 ? entry.debit.toFixed(2) : ''}</td>
        <td style="border: 1px solid #000; padding: 8px 10px; height: 48px; text-align: right;">${entry.credit > 0 ? entry.credit.toFixed(2) : ''}</td>
      </tr>
    `;
  });

  return `
    <div style="font-family: SimSun, '宋体', serif; background: white; padding: 0.6cm; border: 1px solid #ddd;">
      <div style="text-align: center; margin-bottom: 16px;">
        <h1 style="font-size: 22px; margin: 0 0 12px 0; font-weight: bold;">记账凭证</h1>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px;">
          <span>单位：${accountSetName}</span>
          <span>日期：${year}年${parseInt(month)}月${parseInt(day)}日</span>
          <span>凭证号：${voucher.voucherNo}</span>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 8px 10px; width: 25%;">摘要</th>
            <th style="border: 1px solid #000; padding: 8px 10px; width: 25%;">科目</th>
            <th style="border: 1px solid #000; padding: 8px 10px; width: 20%;">借方金额</th>
            <th style="border: 1px solid #000; padding: 8px 10px; width: 20%;">贷方金额</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr>
            <td style="border: 1px solid #000; padding: 8px 10px;" colspan="2">合计：${chineseAmount}</td>
            <td style="border: 1px solid #000; padding: 8px 10px; text-align: right;">${debitTotal.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 8px 10px; text-align: right;">${creditTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div style="display: flex; justify-content: space-between; margin-top: 16px; font-size: 12px;">
        <span>主管：</span>
        <span>记账：</span>
        <span>审核：</span>
        <span>出纳：</span>
        <span>制单：${voucher.createdBy || '会计002'}</span>
      </div>
    </div>
  `;
}

/**
 * 生成批量打印的完整HTML
 */
export function generateBatchPrintHtml(vouchers: Voucher[], accountSetName: string = '未知单位'): string {
  let printHtml = '';

  vouchers.forEach((voucher, index) => {
    const voucherHtml = generateVoucherPrintHtml(voucher, accountSetName);
    printHtml += `
      <div class="voucher-print" style="font-family: SimSun, '宋体', serif; background: white; ${index > 0 ? 'margin-top: 1.2cm;' : ''} padding: 0.6cm; border: 1px solid #ddd;">
        ${voucherHtml.replace(/^<div[^>]*>|<\/div>$/g, '')}
      </div>
    `;
  });

  return printHtml;
}

/**
 * 创建打印iframe并执行打印
 */
export function executePrint(htmlContent: string, title: string = '凭证打印') {
  // 创建 iframe 用于打印
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            @page {
              margin: 0.8cm;
              size: A4 portrait;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .voucher-print {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .voucher-print:nth-child(2n) {
              page-break-after: always;
              break-after: page;
            }
            .voucher-print:last-child {
              page-break-after: auto;
              break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);
    doc.close();

    // 等待 iframe 加载完成后打印
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        // 延迟删除 iframe，给打印一些时间
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 200);
    };
  }
}
