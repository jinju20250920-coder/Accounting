/**
 * 资产凭证生成器
 * 处理资产取得、改造、处置等凭证的生成
 */

import type { FixedAsset, AssetDisposal, AssetImprovement, DepreciationRecord } from '@/types';
import { ACCOUNT_CODES } from './accounting';

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
      subjectCode: asset.assetSubjectCode || ACCOUNT_CODES.FIXED_ASSET,
      subjectName: asset.assetSubjectName || '固定资产',
      debit: asset.originalValue,
      credit: 0,
      summary: `购入${asset.assetName}`,
    });

    // 借：应交税费-进项税（如有）
    if (options?.taxAmount && options.taxAmount > 0) {
      entries.push({
        subjectCode: ACCOUNT_CODES.TAX_VAT_INPUT,
        subjectName: '应交税费-应交增值税-进项税额',
        debit: options.taxAmount,
        credit: 0,
        summary: `购入${asset.assetName}进项税`,
      });
    }

    // 贷：银行存款/应付账款
    const totalAmount = asset.originalValue + (options?.taxAmount || 0);
    entries.push({
      subjectCode: options?.paymentSubjectCode || ACCOUNT_CODES.BANK,
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
      subjectCode: asset.assetSubjectCode || ACCOUNT_CODES.FIXED_ASSET,
      subjectName: asset.assetSubjectName || '固定资产',
      debit: improvement.addedValue,
      credit: 0,
      summary: `${asset.assetName}改造增加原值`,
    });

    // 贷：银行存款/应付账款
    entries.push({
      subjectCode: options?.paymentSubjectCode || ACCOUNT_CODES.BANK,
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
        subjectCode: ACCOUNT_CODES.FIXED_ASSET_CLEARING,
        subjectName: '固定资产清理',
        debit: disposal.disposedNetValue,
        credit: 0,
        summary: `${asset.assetName}处置转入清理`,
      },
      {
        subjectCode: asset.depreciationSubjectCode || ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
        subjectName: asset.depreciationSubjectName || '累计折旧',
        debit: disposal.disposedAccumulatedDepreciation,
        credit: 0,
        summary: `${asset.assetName}处置结转累计折旧`,
      },
      {
        subjectCode: asset.assetSubjectCode || ACCOUNT_CODES.FIXED_ASSET,
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
          subjectCode: ACCOUNT_CODES.BANK,
          subjectName: '银行存款',
          debit: disposal.disposalIncome,
          credit: 0,
          summary: `${asset.assetName}处置收入`,
        },
        {
          subjectCode: ACCOUNT_CODES.FIXED_ASSET_CLEARING,
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
          subjectCode: ACCOUNT_CODES.FIXED_ASSET_CLEARING,
          subjectName: '固定资产清理',
          debit: disposal.disposalExpense,
          credit: 0,
          summary: `${asset.assetName}处置费用`,
        },
        {
          subjectCode: ACCOUNT_CODES.BANK,
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
            subjectCode: ACCOUNT_CODES.FIXED_ASSET_CLEARING,
            subjectName: '固定资产清理',
            debit: 0,
            credit: disposal.netGainLoss,
            summary: `${asset.assetName}处置净收益`,
          },
          {
            subjectCode: ACCOUNT_CODES.NON_OPERATING_INCOME,
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
            subjectCode: ACCOUNT_CODES.NON_OPERATING_EXPENSE,
            subjectName: '营业外支出',
            debit: lossAmount,
            credit: 0,
            summary: `${asset.assetName}处置损失`,
          },
          {
            subjectCode: ACCOUNT_CODES.FIXED_ASSET_CLEARING,
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
      subjectCode: asset.assetSubjectCode || ACCOUNT_CODES.FIXED_ASSET,
      subjectName: asset.assetSubjectName || '固定资产',
      debit: asset.originalValue,
      credit: 0,
      summary: `${asset.assetName}在建工程转固`,
    });

    // 贷：在建工程
    entries.push({
      subjectCode: asset.cipSubjectCode || ACCOUNT_CODES.CONSTRUCTION_IN_PROGRESS,
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

    // 预先构建资产ID到资产对象的映射，避免N+1查找
    const assetMap = new Map(assets.map(a => [a.id, a]));

    // 按费用科目分组汇总
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

    for (const record of records) {
      const asset = assetMap.get(record.assetId);
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
    const expenseList = Array.from(expenseMap.values());
    for (const expense of expenseList) {
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
      subjectCode: ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
      subjectName: '累计折旧',
      debit: 0,
      credit: totalDepreciation,
      summary: '固定资产折旧',
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);

    return { voucherNo, entries };
  }

  /**
   * 生成减值凭证
   * 方式一（计提准备）：借：资产减值损失，贷：减值准备
   * 方式二（直接减少）：借：营业外支出，贷：固定资产
   */
  async generateImpairmentVoucher(
    asset: FixedAsset,
    impairmentAmount: number,
    method: 'provision' | 'direct_reduction',
    date: string,
    accountSetId: string,
    settings: { lossCode: string; provisionCode: string }
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    if (method === 'provision') {
      // 计提减值准备
      entries.push({
        subjectCode: settings.lossCode,
        subjectName: '资产减值损失',
        debit: impairmentAmount,
        credit: 0,
        summary: `${asset.assetName}计提减值准备`,
      });
      entries.push({
        subjectCode: settings.provisionCode,
        subjectName: '固定资产减值准备',
        debit: 0,
        credit: impairmentAmount,
        summary: `${asset.assetName}减值准备`,
      });
    } else {
      // 直接减少原值
      entries.push({
        subjectCode: '6711',
        subjectName: '营业外支出',
        debit: impairmentAmount,
        credit: 0,
        summary: `${asset.assetName}减值损失`,
      });
      entries.push({
        subjectCode: asset.assetSubjectCode || '1501',
        subjectName: asset.assetSubjectName || '固定资产',
        debit: 0,
        credit: impairmentAmount,
        summary: `${asset.assetName}减值`,
      });
    }

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }

  /**
   * 生成重分类凭证（科目变更）
   * 借：新固定资产科目，贷：旧固定资产科目
   * 借：新累计折旧科目，贷：旧累计折旧科目
   */
  async generateReclassifyVoucher(
    asset: FixedAsset,
    oldAssetSubjectCode: string,
    oldAssetSubjectName: string,
    oldDepreciationSubjectCode: string,
    oldDepreciationSubjectName: string,
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 固定资产科目转账
    entries.push({
      subjectCode: asset.assetSubjectCode || '1501',
      subjectName: asset.assetSubjectName || '固定资产',
      debit: asset.originalValue,
      credit: 0,
      summary: `${asset.assetName}重分类转入`,
    });
    entries.push({
      subjectCode: oldAssetSubjectCode,
      subjectName: oldAssetSubjectName,
      debit: 0,
      credit: asset.originalValue,
      summary: `${asset.assetName}重分类转出`,
    });

    // 累计折旧科目转账（如有）
    if (asset.accumulatedDepreciation > 0) {
      entries.push({
        subjectCode: oldDepreciationSubjectCode,
        subjectName: oldDepreciationSubjectName,
        debit: asset.accumulatedDepreciation,
        credit: 0,
        summary: `${asset.assetName}累计折旧重分类转出`,
      });
      entries.push({
        subjectCode: asset.depreciationSubjectCode || '1502',
        subjectName: asset.depreciationSubjectName || '累计折旧',
        debit: 0,
        credit: asset.accumulatedDepreciation,
        summary: `${asset.assetName}累计折旧重分类转入`,
      });
    }

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }

  /**
   * 生成拆分凭证
   * 借：固定资产-A/B/C，贷：固定资产-原
   */
  async generateSplitVoucher(
    sourceAsset: FixedAsset,
    targetAssets: { id: string; code: string; name: string; subjectCode: string; subjectName: string; amount: number }[],
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借方：各目标资产
    for (const target of targetAssets) {
      entries.push({
        subjectCode: target.subjectCode,
        subjectName: target.subjectName,
        debit: target.amount,
        credit: 0,
        summary: `${sourceAsset.assetName}拆分转入${target.name}`,
      });
    }

    // 贷方：原资产
    entries.push({
      subjectCode: sourceAsset.assetSubjectCode || '1501',
      subjectName: sourceAsset.assetSubjectName || '固定资产',
      debit: 0,
      credit: sourceAsset.originalValue,
      summary: `${sourceAsset.assetName}拆分转出`,
    });

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }

  /**
   * 生成合并凭证
   * 借：固定资产-新，贷：固定资产-A/B/C
   */
  async generateMergeVoucher(
    sourceAssets: { id: string; code: string; name: string; subjectCode: string; subjectName: string; amount: number }[],
    targetAsset: FixedAsset,
    date: string,
    accountSetId: string
  ): Promise<GeneratedVoucher> {
    const voucherNo = await this.getVoucherNo(date);
    const entries: VoucherEntry[] = [];

    // 借方：目标资产
    const totalAmount = sourceAssets.reduce((sum, a) => sum + a.amount, 0);
    entries.push({
      subjectCode: targetAsset.assetSubjectCode || '1501',
      subjectName: targetAsset.assetSubjectName || '固定资产',
      debit: totalAmount,
      credit: 0,
      summary: `资产合并转入${targetAsset.assetName}`,
    });

    // 贷方：各原资产
    for (const source of sourceAssets) {
      entries.push({
        subjectCode: source.subjectCode,
        subjectName: source.subjectName,
        debit: 0,
        credit: source.amount,
        summary: `${source.name}合并转出`,
      });
    }

    await this.saveVoucher(voucherNo, date, entries, accountSetId);
    return { voucherNo, entries };
  }
}

export default AssetVoucherGenerator;
