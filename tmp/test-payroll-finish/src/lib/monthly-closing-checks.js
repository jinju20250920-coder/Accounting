"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MONTHLY_CLOSING_TEMPLATES = exports.MONTHLY_CHECK_MODULE_LABELS = void 0;
exports.createMonthlyCheckInstances = createMonthlyCheckInstances;
exports.applyMonthlyCheckRuleConfigs = applyMonthlyCheckRuleConfigs;
exports.buildMonthlyClosingSummary = buildMonthlyClosingSummary;
exports.buildMonthlyClosingReport = buildMonthlyClosingReport;
exports.MONTHLY_CHECK_MODULE_LABELS = {
    bank: '银行流水',
    invoice: '发票',
    expense: '费用报销',
    payroll: '工资社保',
    asset: '固定资产',
    prepaid: '待摊费用',
    inventory: '存货成本',
    settlement: '往来核销',
    tax: '税务检查',
    general_ledger: '总账与报表',
};
exports.DEFAULT_MONTHLY_CLOSING_TEMPLATES = [
    template('bank_import_and_voucher', 'bank', '本月银行流水是否全部导入并生成凭证', '银行回单/银行流水', 'bank_voucher_status', 'blocker', true, true, '/import', 'high'),
    template('bank_reconciliation', 'bank', '银行余额是否与账面余额一致，未达账项是否有说明', '银行对账单/银行日记账', 'bank_reconciliation', 'blocker', true, false, '/fund-hub', 'high'),
    template('input_invoice_certification', 'invoice', '进项发票是否全部导入、分类并完成认证勾选', '发票平台', 'input_invoice_status', 'warning', false, true, '/invoices/input', 'high'),
    template('output_invoice_posting', 'invoice', '销项发票是否全部开具、作废/红冲是否处理并入账', '开票系统', 'output_invoice_voucher_status', 'blocker', true, false, '/invoices/output', 'high'),
    template('expense_reimbursement_voucher', 'expense', '报销单是否全部审核并生成凭证', '报销系统/Excel', 'expense_voucher_status', 'blocker', true, false, '/voucher-entry-page', 'medium'),
    template('payroll_salary_tax', 'payroll', '工资是否计提、发放并完成个税处理', '工资表/个税系统', 'payroll_accrual_status', 'warning', false, true, '/payroll', 'medium'),
    template('payroll_social_fund', 'payroll', '社保、公积金是否计提并与账单核对', '社保账单/公积金账单', 'social_fund_accrual_status', 'warning', false, true, '/payroll', 'medium'),
    template('fixed_asset_change_posting', 'asset', '固定资产新增、减少、报废是否完成入账', '固定资产台账', 'fixed_asset_change_status', 'blocker', true, false, '/assets/fixed', 'high'),
    template('fixed_asset_depreciation', 'asset', '本月折旧是否计提完成并生成凭证', '固定资产模块', 'fixed_asset_depreciation_status', 'blocker', true, true, '/assets/depreciation', 'high'),
    template('prepaid_amortization', 'prepaid', '房租、保险、服务费等是否完成摊销', '待摊费用表', 'prepaid_amortization_status', 'warning', false, true, '/assets/prepaid', 'medium'),
    template('inventory_cost_carry', 'inventory', '采购入库、销售出库及成本结转是否完成', '库存模块/成本明细', 'inventory_cost_carry_status', 'blocker', true, false, '/voucher-entry-page', 'medium'),
    template('inventory_abnormality', 'inventory', '是否存在负库存、异常单价、异常毛利', '库存明细账/毛利表', 'inventory_abnormality_status', 'warning', false, true, '/reports', 'medium'),
    template('settlement_clearing', 'settlement', '应收应付、预收预付是否完成核销', '往来明细账', 'settlement_clearing_status', 'warning', false, true, '/aging/ar', 'medium'),
    template('settlement_aging_explain', 'settlement', '账龄异常客户/供应商是否确认并备注原因', '账龄分析表', 'aging_explain_status', 'warning', false, true, '/aging/ar', 'medium'),
    template('tax_payable_check', 'tax', '增值税、附加税、印花税等是否核对', '税务报表/申报表', 'tax_payable_status', 'warning', false, true, '/reports', 'medium'),
    template('tax_burden_fluctuation', 'tax', '税负率、进销项结构是否存在异常波动', '税务分析表', 'tax_burden_fluctuation', 'warning', false, true, '/reports', 'low'),
    template('voucher_posting_quality', 'general_ledger', '凭证是否存在未过账、断号、摘要异常', '凭证列表/总账', 'voucher_posting_quality', 'blocker', true, false, '/voucher-list', 'high'),
    template('voucher_balance_quality', 'general_ledger', '凭证借贷是否平衡', '凭证列表', 'voucher_balance_quality', 'blocker', true, false, '/voucher-list', 'high'),
    template('gl_key_subject_no_activity', 'general_ledger', '科目余额方向、长期挂账、负数余额是否异常', '总账/科目余额表', 'key_subject_activity', 'warning', false, true, '/balance', 'medium'),
    template('profit_loss_carry_forward', 'general_ledger', '损益结转、期间结转是否完成', '总账', 'profit_loss_carry_forward', 'blocker', true, false, '/voucher-entry-page', 'high'),
    template('financial_statement_balance', 'general_ledger', '资产负债表是否平衡，利润表是否完整', '财务报表', 'financial_statement_balance', 'blocker', true, false, '/reports/assets', 'high'),
    template('cashflow_fluctuation_explain', 'general_ledger', '现金流量表是否存在异常波动并完成说明', '现金流量表', 'cashflow_fluctuation', 'warning', false, true, '/reports/cashflow', 'low'),
];
const FIXED_ASSET_ORIGINAL_CODES = ['1501', '1601', '1604'];
const ACCUMULATED_DEPRECIATION_CODES = ['1502'];
const PREPAID_CODES = ['1801', '1811'];
const KEY_SUBJECT_REVIEW_CODES = ['1002', '1122', '1221', '1405', '2202', '2203', '2211', '2221'];
function template(code, module, title, dataSource, ruleType, severity, blockClosing, allowManualConfirmation, route, priority) {
    return {
        code,
        module,
        title,
        dataSource,
        ruleType,
        severity,
        blockClosing,
        allowManualConfirmation,
        route,
        priority,
    };
}
function createMonthlyCheckInstances(period, templates = exports.DEFAULT_MONTHLY_CLOSING_TEMPLATES, previousInstances = []) {
    const previousByCode = new Map(previousInstances.map((item) => [item.code, item]));
    return templates.map((item) => {
        const previous = previousByCode.get(item.code);
        return {
            ...item,
            owner: item.owner || previous?.owner,
            period,
            manualStatus: 'unchecked',
        };
    });
}
function applyMonthlyCheckRuleConfigs(templates, ruleConfigs = {}) {
    return templates
        .filter((template) => ruleConfigs[template.code]?.enabled !== false)
        .map((template) => {
        const config = ruleConfigs[template.code];
        if (!config)
            return template;
        return {
            ...template,
            severity: config.severity || template.severity,
            blockClosing: config.blockClosing ?? template.blockClosing,
            allowManualConfirmation: config.allowManualConfirmation ?? template.allowManualConfirmation,
            owner: config.owner ?? template.owner,
        };
    });
}
function buildMonthlyClosingSummary(input) {
    const templates = applyMonthlyCheckRuleConfigs(input.templates || exports.DEFAULT_MONTHLY_CLOSING_TEMPLATES, input.ruleConfigs);
    const instances = input.instances || createMonthlyCheckInstances(input.period, templates);
    const results = instances.map((instance) => evaluateCheck(instance, input));
    const completedCount = results.filter((item) => item.completed).length;
    const blockerCount = results.filter((item) => item.systemStatus === 'blocked' && !item.completed).length;
    const warningCount = results.filter((item) => item.systemStatus === 'warning' && !item.completed).length;
    const totalCount = results.length;
    return {
        period: input.period,
        totalCount,
        completedCount,
        pendingCount: totalCount - completedCount,
        warningCount,
        blockerCount,
        progress: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
        canClose: blockerCount === 0,
        items: results,
    };
}
function buildMonthlyClosingReport(input) {
    const { summary } = input;
    const status = summary.canClose ? '可月结' : '不可月结';
    const lines = [
        '# 月结检查报告',
        '',
        `账套：${input.accountSetName}`,
        `期间：${summary.period}`,
        `生成时间：${input.generatedAt}`,
        `月结状态：${status}`,
        '',
        '## 汇总',
        '',
        `- 总检查项：${summary.totalCount}`,
        `- 已完成：${summary.completedCount}`,
        `- 未完成：${summary.pendingCount}`,
        `- 阻塞项：${summary.blockerCount}`,
        `- 提醒项：${summary.warningCount}`,
        `- 完成率：${summary.progress}%`,
        '',
        '## 检查明细',
        '',
        '| 模块 | 检查项 | 系统判断 | 等级 | 人工状态 | 负责人 | 备注 |',
        '|---|---|---|---|---|---|---|',
    ];
    summary.items.forEach((item) => {
        lines.push([
            exports.MONTHLY_CHECK_MODULE_LABELS[item.module],
            item.title,
            item.systemMessage,
            item.systemSeverity,
            item.manualStatus,
            item.owner || '',
            item.note || '',
        ].map(escapeMarkdownCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    });
    return `${lines.join('\n')}\n`;
}
function escapeMarkdownCell(value) {
    return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
function evaluateCheck(instance, input) {
    const period = input.period;
    const vouchers = input.vouchers || [];
    const bankTransactions = (input.bankTransactions || []).filter((item) => isInPeriod(item.date, period));
    const invoices = (input.invoices || []).filter((item) => isInPeriod(item.invoiceDate, period));
    const confirmedPayrollBatches = (input.payrollBatches || []).filter((item) => item.status === 'confirmed');
    switch (instance.code) {
        case 'bank_import_and_voucher': {
            if (bankTransactions.length === 0) {
                return result(instance, 'warning', 'warning', '本月尚未发现银行流水。若本月确实无银行交易，可人工确认无须处理。', 1, false);
            }
            const ungenerated = bankTransactions.filter((item) => item.status !== 'voucher_generated' && !item.voucherId).length;
            if (ungenerated > 0) {
                return result(instance, instance.blockClosing ? 'blocked' : 'warning', instance.blockClosing ? 'blocker' : 'warning', `存在 ${ungenerated} 条银行流水未生成凭证。`, ungenerated);
            }
            return result(instance, 'passed', 'info', '本月银行流水已生成凭证。', 0);
        }
        case 'input_invoice_certification': {
            const inputInvoices = invoices.filter((item) => item.invoiceType === 'input');
            if (inputInvoices.length === 0)
                return result(instance, 'no_data', 'info', '本月暂未发现进项发票。', 0);
            const withoutVoucher = inputInvoices.filter((item) => !item.voucherId).length;
            if (withoutVoucher > 0)
                return result(instance, 'warning', 'warning', `存在 ${withoutVoucher} 张进项发票尚未生成凭证或完成认证确认。`, withoutVoucher);
            return result(instance, 'passed', 'info', '本月进项发票已处理。', 0);
        }
        case 'output_invoice_posting': {
            const outputInvoices = invoices.filter((item) => item.invoiceType === 'output');
            if (outputInvoices.length === 0)
                return result(instance, 'no_data', 'info', '本月暂未发现销项发票。', 0);
            const withoutVoucher = outputInvoices.filter((item) => !item.voucherId).length;
            if (withoutVoucher > 0)
                return result(instance, 'blocked', 'blocker', `存在 ${withoutVoucher} 张销项发票未入账。`, withoutVoucher);
            return result(instance, 'passed', 'info', '本月销项发票已入账。', 0);
        }
        case 'payroll_salary_tax': {
            if (confirmedPayrollBatches.length === 0) {
                return result(instance, 'warning', 'warning', '本月尚无已确认工资计算批次，请完成工资导入、个税计算并核对后确认。', 1);
            }
            return result(instance, 'warning', 'warning', '已确认工资计算批次并包含个税计算结果；工资计提、发放及个税申报仍需核对确认。', 1);
        }
        case 'payroll_social_fund': {
            const hasSocialFundCalculation = confirmedPayrollBatches.some((item) => item.includesSocialFundCalculation);
            if (!hasSocialFundCalculation) {
                return result(instance, 'warning', 'warning', '本月尚无已确认的社保、公积金计算结果，请完成配置和核对。', 1);
            }
            return result(instance, 'warning', 'warning', '已找到已确认工资批次中的社保、公积金计算结果；实际计提与缴纳仍需核对确认。', 1);
        }
        case 'fixed_asset_depreciation': {
            const originalBalance = Math.max(0, sumEntries(vouchers, FIXED_ASSET_ORIGINAL_CODES, 'balanceDebit'));
            const depreciationBalance = Math.max(0, sumEntries(vouchers, ACCUMULATED_DEPRECIATION_CODES, 'balanceCredit'));
            const currentDepreciation = sumEntries(vouchers, ACCUMULATED_DEPRECIATION_CODES, 'credit', period);
            if ((originalBalance > 0 || depreciationBalance > 0) && currentDepreciation <= 0) {
                return result(instance, instance.blockClosing ? 'blocked' : 'warning', instance.blockClosing ? 'blocker' : 'warning', `固定资产原值余额 ${originalBalance.toFixed(2)}，累计折旧余额 ${depreciationBalance.toFixed(2)}，本期未发现折旧计提。`, 1);
            }
            return result(instance, originalBalance > 0 || depreciationBalance > 0 ? 'passed' : 'no_data', 'info', '固定资产折旧检查未发现异常。', 0);
        }
        case 'prepaid_amortization': {
            const prepaidBalance = Math.max(0, sumEntries(vouchers, PREPAID_CODES, 'balanceDebit'));
            const currentAmortization = sumEntries(vouchers, PREPAID_CODES, 'credit', period);
            if (prepaidBalance > 0 && currentAmortization <= 0) {
                return result(instance, 'warning', 'warning', `待摊费用余额 ${prepaidBalance.toFixed(2)}，本期未发现摊销发生额。`, 1);
            }
            return result(instance, prepaidBalance > 0 ? 'passed' : 'no_data', 'info', '待摊费用摊销检查未发现异常。', 0);
        }
        case 'voucher_posting_quality': {
            const unposted = vouchers.filter((item) => isInPeriod(item.date, period) && (item.status === 'draft' || item.status === 'review')).length;
            if (unposted > 0)
                return result(instance, 'blocked', 'blocker', `存在 ${unposted} 张凭证未过账。`, unposted);
            return result(instance, 'passed', 'info', '本期凭证均已过账。', 0);
        }
        case 'voucher_balance_quality': {
            const unbalanced = vouchers.filter((voucher) => isInPeriod(voucher.date, period) && !isVoucherBalanced(voucher)).length;
            if (unbalanced > 0)
                return result(instance, 'blocked', 'blocker', `存在 ${unbalanced} 张凭证借贷不平。`, unbalanced);
            return result(instance, 'passed', 'info', '本期凭证借贷平衡。', 0);
        }
        case 'gl_key_subject_no_activity': {
            const inactiveSubjects = KEY_SUBJECT_REVIEW_CODES.filter((code) => {
                const balance = Math.abs(sumEntries(vouchers, [code], 'balanceDebit'));
                const currentDebit = sumEntries(vouchers, [code], 'debit', period);
                const currentCredit = sumEntries(vouchers, [code], 'credit', period);
                return balance > 0 && currentDebit <= 0 && currentCredit <= 0;
            });
            if (inactiveSubjects.length > 0) {
                return result(instance, 'warning', 'warning', `重点科目 ${inactiveSubjects.join('、')} 有余额但本期无发生额，请确认是否正常。`, inactiveSubjects.length);
            }
            return result(instance, 'passed', 'info', '重点科目余额和发生额检查未发现异常。', 0);
        }
        default:
            return result(instance, 'unchecked', instance.severity, '该检查项需要人工维护或后续接入业务模块自动判断。', 0);
    }
}
function result(instance, systemStatus, systemSeverity, systemMessage, exceptionCount, blockClosingOverride) {
    const manuallyCompleted = instance.manualStatus === 'completed' || instance.manualStatus === 'confirmed_not_needed' || instance.manualStatus === 'explained';
    const systemPassed = systemStatus === 'passed' || systemStatus === 'no_data';
    const canCompleteByConfirmation = instance.allowManualConfirmation && manuallyCompleted;
    const completed = systemPassed || canCompleteByConfirmation;
    return {
        ...instance,
        blockClosing: blockClosingOverride ?? instance.blockClosing,
        systemStatus,
        systemSeverity,
        systemMessage,
        exceptionCount,
        completed,
    };
}
function isInPeriod(date, period) {
    return Boolean(date?.startsWith(period));
}
function includesCode(subjectCode, codes) {
    return codes.some((code) => subjectCode === code || subjectCode.startsWith(code));
}
function sumEntries(vouchers, codes, side, period) {
    return vouchers
        .filter((voucher) => voucher.status === 'posted' && (!period || isInPeriod(voucher.date, period)))
        .flatMap((voucher) => voucher.entries)
        .filter((entry) => includesCode(entry.subjectCode, codes))
        .reduce((sum, entry) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        if (side === 'debit')
            return sum + debit;
        if (side === 'credit')
            return sum + credit;
        if (side === 'balanceDebit')
            return sum + debit - credit;
        return sum + credit - debit;
    }, 0);
}
function isVoucherBalanced(voucher) {
    const debit = voucher.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const credit = voucher.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return Math.abs(debit - credit) < 0.01;
}
