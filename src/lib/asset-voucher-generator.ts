/**
 * 资产凭证生成器
 * 处理资产取得、改造、处置等凭证的生成
 */

import type { FixedAsset, AssetDisposal, AssetImprovement, DepreciationRecord } from '@/types';

interface VoucherEntry {
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
  summary: string;
}

interface GeneratedVoucher {
  voucherNo: string;
  entries: VoucherEntry[];
}

export class AssetVoucherGenerator {
  private generateId: () => string;
  private getVoucherNo: (date: string) => Promise<string>;
  private saveVoucher: (voucherNo: string, date: string, entries: VoucherEntry[], accountSetId: string) => Promise<string>;

  constructor(
    generateId: () => string,
    getVoucherNo: (date: string) => Promise<string>,
    saveVoucher: (voucherNo: string, date: string, entries: VoucherEntry[], accountSetId: string) => Promise<string>
  ) {
    this.generateId = generateId;
    this.getVoucherNo = getVoucherNo;
    this.saveVoucher = saveVoucher;
  }

  /**
   * 生成资产取得凭证
   * 借：固定资产
   * 借：应交税费-进项税（如有）
   * 贷：银行存款/应付账款
   */
  async generateAcquisitionVoucher(
    asset: FixedAsset,
    date: string,
    accountSetId: string,
    options?: {
      taxAmount?: number;
      paymentSubjectCode?: string;
      paymentSubjectName?: string;
    }
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借：固定资产
    entries.push({
      subjectCode: asset.assetSubjectCode || '1501',
      subjectName: asset.assetSubjectName || '固定资产',
      debit: asset.originalValue,
      credit: 0,
      summary: `购入${asset.assetName}`,
    });

    // 借：应交税费-进项税（如有）
    if (options?.taxAmount && options.taxAmount > 0) {
      entries.push({
        subjectCode: '222101',
        subjectName: '应交税费-应交增值税-进项税额',
        debit: options.taxAmount,
        credit: 0,
        summary: `购入${asset.assetName}进项税`,
      });
    }

    // 贷：银行存款/应付账款
    const totalAmount = asset.originalValue + (options?.taxAmount || 0);
    entries.push({
      subjectCode: options?.paymentSubjectCode || '1002',
      subjectName: options?.paymentSubjectName || '银行存款',
      debit: 0,
      credit: totalAmount,
      summary: `支付${asset.assetName}款项`,
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);

    return { voucherNo, entries };
  }

  /**
   * 生成资产改造凭证
   * 借：固定资产
   * 贷：银行存款/应付账款
   */
  async generateImprovementVoucher(
    asset: FixedAsset,
    improvement: AssetImprovement,
    date: string,
    accountSetId: string,
    options?: {
      paymentSubjectCode?: string;
      paymentSubjectName?: string;
    }
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借：固定资产
    entries.push({
      subjectCode: asset.assetSubjectCode || '1501',
      subjectName: asset.assetSubjectName || '固定资产',
      debit: improvement.addedValue,
      credit: 0,
      summary: `${asset.assetName}改造增加原值`,
    });

    // 贷：银行存款/应付账款
    entries.push({
      subjectCode: options?.paymentSubjectCode || '1002',
      subjectName: options?.paymentSubjectName || '银行存款',
      debit: 0,
      credit: improvement.addedValue,
      summary: `支付${asset.assetName}改造费用`,
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);

    return { voucherNo, entries };
  }

  /**
   * 生成资产处置凭证（多步骤）
   * Step 1: 转入清理
   * Step 2: 清理收入
   * Step 3: 清理费用
   * Step 4: 结转损益
   */
  async generateDisposalVouchers(
    asset: FixedAsset,
    disposal: AssetDisposal,
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher[]> {
    const vouchers: GeneratedVoucher[] = [];

    // Step 1: 转入清理
    // 借：固定资产清理（净值）
    // 借：累计折旧
    // 贷：固定资产（原值）
    const voucher1No = await this.getVoucherNo(date);
    const entries1: VoucherEntry[] = [
      {
        subjectCode: '1601',
        subjectName: '固定资产清理',
        debit: disposal.disposedNetValue,
        credit: 0,
        summary: `${asset.assetName}处置转入清理`,
      },
      {
        subjectCode: asset.depreciationSubjectCode || '1502',
        subjectName: asset.depreciationSubjectName || '累计折旧',
        debit: disposal.disposedAccumulatedDepreciation,
        credit: 0,
        summary: `${asset.assetName}处置结转累计折旧`,
      },
      {
        subjectCode: asset.assetSubjectCode || '1501',
        subjectName: asset.assetSubjectName || '固定资产',
        debit: 0,
        credit: disposal.disposedOriginalValue,
        summary: `${asset.assetName}处置减少`,
      },
    ];
    await this.saveVoucher(voucher1No, date, entries1, accountSetId);
    vouchers.push({ voucherNo: voucher1No, entries: entries1 });

    // Step 2: 清理收入（如有）
    if (disposal.disposalIncome > 0) {
      const voucher2No = await this.getVoucherNo(date);
      const entries2: VoucherEntry[] = [
        {
          subjectCode: '1002',
          subjectName: '银行存款',
          debit: disposal.disposalIncome,
          credit: 0,
          summary: `${asset.assetName}处置收入`,
        },
        {
          subjectCode: '1601',
          subjectName: '固定资产清理',
          debit: 0,
          credit: disposal.disposalIncome,
          summary: `${asset.assetName}处置收入`,
        },
      ];
      await this.saveVoucher(voucher2No, date, entries2, accountSetId);
      vouchers.push({ voucherNo: voucher2No, entries: entries2 });
    }

    // Step 3: 清理费用（如有）
    if (disposal.disposalExpense > 0) {
      const voucher3No = await this.getVoucherNo(date);
      const entries3: VoucherEntry[] = [
        {
          subjectCode: '1601',
          subjectName: '固定资产清理',
          debit: disposal.disposalExpense,
          credit: 0,
          summary: `${asset.assetName}处置费用`,
        },
        {
          subjectCode: '1002',
          subjectName: '银行存款',
          debit: 0,
          credit: disposal.disposalExpense,
          summary: `支付${asset.assetName}处置费用`,
        },
      ];
      await this.saveVoucher(voucher3No, date, entries3, accountSetId);
      vouchers.push({ voucherNo: voucher3No, entries: entries3 });
    }

    // Step 4: 结转损益
    if (disposal.netGainLoss !== 0) {
      const voucher4No = await this.getVoucherNo(date);
      const entries4: VoucherEntry[] = [];

      if (disposal.netGainLoss > 0) {
        // 净收益
        entries4.push(
          {
            subjectCode: '1601',
            subjectName: '固定资产清理',
            debit: 0,
            credit: disposal.netGainLoss,
            summary: `${asset.assetName}处置净收益`,
          },
          {
            subjectCode: '6301',
            subjectName: '营业外收入',
            debit: 0,
            credit: disposal.netGainLoss,
            summary: `${asset.assetName}处置收益`,
          }
        );
      } else {
        // 净损失
        const lossAmount = Math.abs(disposal.netGainLoss);
        entries4.push(
          {
            subjectCode: '6711',
            subjectName: '营业外支出',
            debit: lossAmount,
            credit: 0,
            summary: `${asset.assetName}处置损失`,
          },
          {
            subjectCode: '1601',
            subjectName: '固定资产清理',
            debit: lossAmount,
            credit: 0,
            summary: `${asset.assetName}处置净损失`,
          }
        );
      }

      await this.saveVoucher(voucher4No, date, entries4, accountSetId);
      vouchers.push({ voucherNo: voucher4No, entries: entries4 });
    }

    return vouchers;
  }

  /**
   * 生成在建转固凭证
   * 借：固定资产
   * 贷：在建工程
   */
  async generateCIPConversionVoucher(
    asset: FixedAsset,
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借：固定资产
    entries.push({
      subjectCode: asset.assetSubjectCode || '1501',
      subjectName: asset.assetSubjectName || '固定资产',
      debit: asset.originalValue,
      credit: 0,
      summary: `${asset.assetName}在建工程转固`,
    });

    // 贷：在建工程
    entries.push({
      subjectCode: asset.cipSubjectCode || '1604',
      subjectName: asset.cipSubjectName || '在建工程',
      debit: 0,
      credit: asset.originalValue,
      summary: `${asset.assetName}在建工程转固`,
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);

    return { voucherNo, entries };
  }

  /**
   * 生成折旧凭证
   * 借：管理费用-折旧费/制造费用
   * 贷：累计折旧
   */
  async generateDepreciationVoucher(
    records: DepreciationRecord[],
    assets: FixedAsset[],
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 按费用科目分组汇总
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

    for (const record of records) {
      const asset = assets.find(a => a.id === record.assetId);
      if (!asset) continue;

      const expenseCode = asset.expenseSubjectCode || '660204';
      const expenseName = asset.expenseSubjectName || '管理费用-折旧费';

      const existing = expenseMap.get(expenseCode);
      if (existing) {
        existing.amount += record.periodDepreciation;
      } else {
        expenseMap.set(expenseCode, {
          code: expenseCode,
          name: expenseName,
          amount: record.periodDepreciation,
        });
      }
    }

    // 借方：费用科目
    for (const [, expense] of expenseMap) {
      entries.push({
        subjectCode: expense.code,
        subjectName: expense.name,
        debit: expense.amount,
        credit: 0,
        summary: '固定资产折旧',
      });
    }

    // 贷方：累计折旧
    const totalDepreciation = records.reduce((sum, r) => sum + r.periodDepreciation, 0);
    entries.push({
      subjectCode: '1502',
      subjectName: '累计折旧',
      debit: 0,
      credit: totalDepreciation,
      summary: '固定资产折旧',
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);

    return { voucherNo, entries };
  }
}

export default AssetVoucherGenerator;
