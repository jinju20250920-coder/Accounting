/**
 * Invoice Smart Rule Engine v2.0
 *
 * Pure logic module — no React, no database calls, no side effects.
 * Takes data as parameters and returns results.
 * The store layer wires it to the database.
 */

import type {
  Invoice,
  SmartRuleCondition,
  TextCondition,
  NumericCondition,
  SupplierListCondition,
  InvoiceSmartRule,
  OverrideSubjectAction,
  AssignAuxiliaryAction,
  MarkAsAction,
  CreateFixedAssetAction,
  SupplierSubjectAction,
  ReimbursementSubjectAction,
  ActionResult,
  AuxiliaryResult,
  ReimbursementResult,
  SupplierSubjectMapping,
  ExpenseReimbursement,
  ExpenseKeywordCategory,
  AuxiliaryStrategyConfig,
  EngineContext,
  FixedAsset,
  Subject,
  DepreciationMethod,
} from '@/types';

// ---------------------------------------------------------------------------
// Field map: condition field names → Invoice object keys
// ---------------------------------------------------------------------------
const FIELD_MAP: Record<string, string> = {
  goodsName: 'goodsName',
  sellerName: 'sellerName',
  notes: 'notes',
  totalAmount: 'totalAmount',
  taxRate: 'taxRate',
};

// ---------------------------------------------------------------------------
// Helper: check whether a subject has any auxiliary capability enabled
// ---------------------------------------------------------------------------
export function hasAuxiliaryCapability(subject: Subject): boolean {
  return !!(
    subject.isCustomer ||
    subject.isSupplier ||
    subject.isEmployee ||
    subject.enableDept ||
    subject.enableProject ||
    subject.enableCashFlow
  );
}

// ---------------------------------------------------------------------------
// Step 1: Condition evaluation
// ---------------------------------------------------------------------------

export function evaluateCondition(
  invoice: Invoice,
  condition: SmartRuleCondition,
  supplierMappings: SupplierSubjectMapping[],
): boolean {
  // Supplier-list condition — special case
  if (condition.field === 'supplierInList') {
    const sc = condition as SupplierListCondition;
    return supplierMappings.some(
      (m) => m.groupName === sc.groupName && m.sellerName === invoice.sellerName,
    );
  }

  const fieldName = FIELD_MAP[condition.field];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (invoice as any)[fieldName];

  // Numeric condition
  if (condition.field === 'totalAmount' || condition.field === 'taxRate') {
    const nc = condition as NumericCondition;
    const numValue = Number(value);
    switch (nc.operator) {
      case '>':
        return numValue > nc.value;
      case '<':
        return numValue < nc.value;
      case '>=':
        return numValue >= nc.value;
      case '<=':
        return numValue <= nc.value;
      case 'equals':
        return numValue === nc.value;
      default:
        return false;
    }
  }

  // Text condition
  const tc = condition as TextCondition;
  const strValue = String(value || '').toLowerCase();
  return tc.values.some((v) => {
    const lower = v.toLowerCase();
    return tc.operator === 'equals' ? strValue === lower : strValue.includes(lower);
  });
}

export function evaluateConditions(
  invoice: Invoice,
  conditions: SmartRuleCondition[],
  supplierMappings: SupplierSubjectMapping[],
): boolean {
  return conditions.every((c) => evaluateCondition(invoice, c, supplierMappings));
}

// ---------------------------------------------------------------------------
// Step 2: Rule matching
// ---------------------------------------------------------------------------

/**
 * Find the highest-priority enabled rule whose conditions match the invoice.
 * Returns `null` when no rule matches.
 */
export function matchRule(
  invoice: Invoice,
  rules: InvoiceSmartRule[],
  supplierMappings: SupplierSubjectMapping[],
): InvoiceSmartRule | null {
  const applicableRules = rules
    .filter((r) => r.enabled && (r.invoiceType === 'both' || r.invoiceType === invoice.invoiceType))
    .sort((a, b) => b.priority - a.priority || a.createTime.localeCompare(b.createTime));

  for (const rule of applicableRules) {
    if (evaluateConditions(invoice, rule.conditions, supplierMappings)) {
      return rule;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 3: Action resolvers
// ---------------------------------------------------------------------------

/**
 * Look up supplier in mapping table by sellerName, return slot overrides
 * based on the supplier's default subjects.
 */
function resolveSupplierSubject(
  invoice: Invoice,
  _action: SupplierSubjectAction,
  supplierMappings: SupplierSubjectMapping[],
): Record<string, { code: string; name: string }> {
  const mapping = supplierMappings.find(
    (m) => m.sellerName === invoice.sellerName,
  );
  if (!mapping) return {};

  const overrides: Record<string, { code: string; name: string }> = {};
  if (mapping.defaultDebitSubject) {
    overrides['debit'] = { code: mapping.defaultDebitSubject, name: mapping.defaultDebitSubjectName || '' };
  }
  if (mapping.defaultTaxSubject) {
    overrides['tax'] = { code: mapping.defaultTaxSubject, name: mapping.defaultTaxSubjectName || '' };
  }
  if (mapping.defaultCreditSubject) {
    overrides['credit'] = { code: mapping.defaultCreditSubject, name: mapping.defaultCreditSubjectName || '' };
  }
  return overrides;
}

/**
 * Look up expense reimbursement by invoice code, resolve reimburser info.
 * Actual partner creation happens in the store layer, not here.
 */
function resolveReimbursement(
  invoice: Invoice,
  action: ReimbursementSubjectAction,
  expenseReimbursements: ExpenseReimbursement[],
): ReimbursementResult {
  const record = expenseReimbursements.find(
    (r) => r.invoiceCode === invoice.invoiceCode,
  );
  if (!record) {
    return { creditOverride: null, reimburserName: null, partnerCreated: false };
  }

  return {
    creditOverride: { code: action.creditSubjectCode, name: action.creditSubjectName },
    reimburserName: record.reimburserName,
    partnerCreated: false,
  };
}

/**
 * Build a FixedAsset object from invoice data and action config.
 * The asset is in a de-facto draft state: status='active' but depreciationStartDate is undefined.
 */
function buildAssetCard(
  invoice: Invoice,
  action: CreateFixedAssetAction,
  assetCode: string,
): Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> {
  const salvageValue =
    Math.round(invoice.totalAmount * (action.residualRate ?? 0.05) * 100) / 100;
  const depreciableValue = invoice.totalAmount - salvageValue;

  return {
    assetCode,
    assetName: invoice.goodsName || '未命名资产',
    categoryName: action.assetCategory,
    quantity: invoice.quantity ?? 1,
    remainingQuantity: invoice.quantity ?? 1,
    unit: invoice.unit || '台',
    unitPrice: invoice.totalAmount / (invoice.quantity ?? 1),
    acquisitionType: 'invoice',
    specification: invoice.specification || '',
    originalValue: invoice.totalAmount,
    salvageValue,
    depreciableValue,
    accumulatedDepreciation: 0,
    netValue: invoice.totalAmount,
    depreciationMethod: action.depreciationMethod,
    usefulLifeYears: action.depreciationYears,
    usefulLifeMonths: action.depreciationYears * 12,
    acquisitionDate: invoice.invoiceDate,
    depreciationStartDate: undefined, // manual confirmation needed
    status: 'active', // active but depreciationStartDate empty = de facto draft
    assetSubjectCode: action.assetSubjectCode,
    depreciationSubjectCode: action.depreciationSubjectCode,
    expenseSubjectCode: action.expenseSubjectCode,
    supplierName: invoice.sellerName,
    invoiceNo: invoice.invoiceCode,
  };
}

/**
 * Resolve auxiliary accounting assignment from action config.
 */
function resolveAuxiliaryStrategy(
  invoice: Invoice,
  action: AssignAuxiliaryAction,
  _strategy: AuxiliaryStrategyConfig | null, // eslint-disable-line @typescript-eslint/no-unused-vars
): AuxiliaryResult {
  // Determine auxiliary name from source field
  let auxiliaryName: string | null = null;
  if (action.sourceField === 'sellerName') {
    auxiliaryName = invoice.sellerName;
  } else if (action.sourceField === 'notes') {
    auxiliaryName = invoice.notes || null;
  }

  // If specific names provided and no name from source, use first as default
  if (action.nameList && action.nameList.length > 0 && !auxiliaryName) {
    auxiliaryName = action.nameList[0];
  }

  const auxiliaryDisabled = false;

  return {
    debitAuxiliary: action.auxiliaryType === 'employee' ? null : auxiliaryName,
    creditAuxiliary: action.auxiliaryType === 'employee' ? auxiliaryName : null,
    debitNeedsPrompt: action.auxiliaryType !== 'employee' && !!auxiliaryName,
    creditNeedsPrompt: action.auxiliaryType === 'employee' && !auxiliaryName,
    auxiliaryDisabled,
    docNo: invoice.invoiceCode, // ALWAYS set to invoice code
  };
}

/**
 * Match invoice against expense keyword library to detect expense category.
 */
export function detectExpenseCategory(
  invoice: Invoice,
  categories: ExpenseKeywordCategory[],
): ExpenseKeywordCategory | null {
  const text = `${invoice.goodsName || ''} ${invoice.notes || ''}`.toLowerCase();
  for (const cat of categories) {
    if (!cat.enabled) continue;
    if (cat.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return cat;
    }
  }
  return null;
}

/**
 * Generate a unique asset code in FA-YYYYMM-NNN format.
 */
export function generateAssetCode(existingCodes: string[]): string {
  const now = new Date();
  const prefix = `FA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const existing = existingCodes
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.substring(prefix.length + 1), 10))
    .filter((n) => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Step 4: Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Execute all actions from a matched rule and return the combined result.
 */
export function executeActions(context: EngineContext): ActionResult {
  const {
    invoice,
    matchedRule,
    supplierMappings,
    expenseReimbursements,
    auxiliaryStrategy,
    expenseKeywords,
    assetMappings,
    baseTaxSubject,
  } = context;

  // No rule matched — apply default logic
  if (!matchedRule) {
    const defaultResult = {
      subjectOverrides: {},
      auxiliaryResult: {
        debitAuxiliary: null,
        creditAuxiliary: null,
        debitNeedsPrompt: false,
        creditNeedsPrompt: false,
        auxiliaryDisabled: false,
        docNo: invoice.invoiceCode,
      },
      markCategory: null,
      fixedAssetCard: null,
      reimburserName: null,
      partnerCreated: false,
    };

    // Apply dynamic tax subject logic even when no rule matches
    const taxSubject = getDynamicTaxSubject(invoice, baseTaxSubject);
    if (taxSubject) {
      defaultResult.subjectOverrides['tax'] = taxSubject;
    }

    // Apply automatic fixed asset classification based on amount threshold
    const autoFixedAsset = getAutomaticFixedAsset(invoice, assetMappings);
    if (autoFixedAsset) {
      defaultResult.fixedAssetCard = autoFixedAsset;
      defaultResult.markCategory = 'fixed_asset';
    }

    return defaultResult;
  }

  const subjectOverrides: Record<string, { code: string; name: string }> = {};
  let auxiliaryResult: AuxiliaryResult | null = null;
  let markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null = null;
  let fixedAssetCard: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null = null;
  let reimburserName: string | null = null;
  const partnerCreated = false;

  // Collect overrides by priority tier
  const overrideTier: Record<string, { code: string; name: string }>[] = [{}, {}, {}]; // [override, supplier, reimbursement]

  for (const action of matchedRule.actions) {
    switch (action.type) {
      case 'overrideSubject': {
        const oa = action as OverrideSubjectAction;
        overrideTier[0][oa.slot] = { code: oa.subjectCode, name: oa.subjectName };
        break;
      }
      case 'supplierSubject': {
        const sa = action as SupplierSubjectAction;
        const supplierOverrides = resolveSupplierSubject(invoice, sa, supplierMappings);
        for (const [slot, val] of Object.entries(supplierOverrides)) {
          overrideTier[1][slot] = val;
        }
        break;
      }
      case 'reimbursementSubject': {
        const ra = action as ReimbursementSubjectAction;
        const result = resolveReimbursement(invoice, ra, expenseReimbursements);
        if (result.creditOverride) {
          overrideTier[2]['credit'] = result.creditOverride;
        }
        reimburserName = result.reimburserName;
        break;
      }
      case 'markAs': {
        const ma = action as MarkAsAction;
        markCategory = ma.category;
        break;
      }
      case 'createFixedAsset': {
        const fa = action as CreateFixedAssetAction;
        const assetCode = generateAssetCode([]); // store layer will pass real existing codes
        fixedAssetCard = buildAssetCard(invoice, fa, assetCode);
        break;
      }
      case 'assignAuxiliary': {
        const aa = action as AssignAuxiliaryAction;
        auxiliaryResult = resolveAuxiliaryStrategy(invoice, aa, auxiliaryStrategy);
        break;
      }
    }
  }

  // Apply dynamic tax subject logic (overrides any rule-defined tax subject)
  const taxSubject = getDynamicTaxSubject(invoice, baseTaxSubject);
  if (taxSubject) {
    subjectOverrides['tax'] = taxSubject;
  }

  // Apply automatic fixed asset classification if not explicitly set by rule
  if (!fixedAssetCard) {
    const autoFixedAsset = getAutomaticFixedAsset(invoice, assetMappings);
    if (autoFixedAsset) {
      fixedAssetCard = autoFixedAsset;
      if (!markCategory) {
        markCategory = 'fixed_asset';
      }
    }
  }

  // Apply overrides with hardcoded priority: reimbursement > supplier > override
  for (const tier of overrideTier) {
    for (const [slot, val] of Object.entries(tier)) {
      // Don't override tax subject if dynamic tax logic has already set it
      if (slot !== 'tax' || !subjectOverrides['tax']) {
        subjectOverrides[slot] = val;
      }
    }
  }

  // If no auxiliary action was set, still set docNo
  if (!auxiliaryResult) {
    auxiliaryResult = {
      debitAuxiliary: null,
      creditAuxiliary: null,
      debitNeedsPrompt: false,
      creditNeedsPrompt: false,
      auxiliaryDisabled: false,
      docNo: invoice.invoiceCode,
    };
  }

  return {
    subjectOverrides,
    auxiliaryResult,
    markCategory,
    fixedAssetCard,
    reimburserName,
    partnerCreated,
  };
}

/**
 * Get dynamic tax subject based on invoice tax rate and base tax subject
 * baseTaxSubject: e.g. "2221" → generates "22210113" (进项) or "22210213" (销项)
 * The base code is extended with 01 (进项) or 02 (销项) + tax rate percentage
 */
export function getDynamicTaxSubject(invoice: Invoice, baseTaxSubject?: string): { code: string; name: string } | null {
  if (!invoice.taxRate) return null;

  const taxRatePercent = Math.round(invoice.taxRate * 100);
  const isInput = invoice.invoiceType === 'input';
  const suffix = isInput ? '01' : '02';
  const baseName = isInput ? '进项税额' : '销项税额';

  // Use base tax subject if provided, otherwise default to 2221
  const base = baseTaxSubject || '2221';

  // Remove dots from base code (e.g. "2221.01" → "222101")
  const cleanBase = base.replace(/\./g, '');

  // If base already ends with 01/02, don't add suffix again
  const code = cleanBase.endsWith('01') || cleanBase.endsWith('02')
    ? `${cleanBase}${taxRatePercent.toString().padStart(2, '0')}`
    : `${cleanBase}${suffix}${taxRatePercent.toString().padStart(2, '0')}`;

  const name = `${baseName}(${taxRatePercent}%)`;

  return { code, name };
}

/**
 * Get automatic fixed asset card based on amount threshold and asset mappings
 * Default threshold: 5000 yuan
 */
function getAutomaticFixedAsset(invoice: Invoice, assetMappings: any[]): Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null {
  // Default amount threshold for fixed asset classification
  const FIXED_ASSET_THRESHOLD = 5000;

  if (invoice.totalAmount < FIXED_ASSET_THRESHOLD) return null;

  // Match asset category based on keywords
  const assetCategory = matchAssetCategory(invoice, assetMappings);
  if (!assetCategory) return null;

  // Generate asset code
  const assetCode = generateAssetCode([]);

  // Build asset card
  return {
    assetCode,
    assetName: invoice.goodsName || '未命名资产',
    categoryName: assetCategory.assetCategory,
    quantity: invoice.quantity ?? 1,
    remainingQuantity: invoice.quantity ?? 1,
    unit: invoice.unit || '台',
    unitPrice: invoice.totalAmount / (invoice.quantity ?? 1),
    acquisitionType: 'invoice',
    specification: invoice.specification || '',
    originalValue: invoice.totalAmount,
    salvageValue: Math.round(invoice.totalAmount * 0.05 * 100) / 100, // 5% residual rate
    depreciableValue: invoice.totalAmount - (Math.round(invoice.totalAmount * 0.05 * 100) / 100),
    accumulatedDepreciation: 0,
    netValue: invoice.totalAmount,
    depreciationMethod: assetCategory.depreciationMethod as DepreciationMethod || 'straight_line',
    usefulLifeYears: assetCategory.depreciationYears || 5,
    usefulLifeMonths: (assetCategory.depreciationYears || 5) * 12,
    acquisitionDate: invoice.invoiceDate,
    depreciationStartDate: undefined, // manual confirmation needed
    status: 'active', // active but depreciationStartDate empty = de facto draft
    assetSubjectCode: assetCategory.subjectCode || '1601',
    depreciationSubjectCode: '1602', // Default accumulated depreciation subject
    expenseSubjectCode: '6602', // Default expense subject
    supplierName: invoice.sellerName,
    invoiceNo: invoice.invoiceCode,
  };
}

/**
 * Match asset category based on invoice goods name and asset mappings
 */
function matchAssetCategory(invoice: Invoice, assetMappings: any[]): any | null {
  const text = `${invoice.goodsName || ''} ${invoice.notes || ''}`.toLowerCase();

  for (const mapping of assetMappings) {
    if (mapping.keywords.some((kw: string) => text.includes(kw.toLowerCase()))) {
      return mapping;
    }
  }

  // Default asset category if no mapping found (for high-value items)
  if (invoice.totalAmount >= 10000) {
    return {
      assetCategory: '其他固定资产',
      depreciationYears: 5,
      depreciationMethod: 'straight_line',
      subjectCode: '1601',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step 5: Slot maps — map abstract slots to template entry positions
// ---------------------------------------------------------------------------

export const INPUT_SLOT_MAP: Record<string, string> = {
  debit: 'entry_1',
  tax: 'entry_2',
  credit: 'entry_3',
};

export const OUTPUT_SLOT_MAP: Record<string, string> = {
  debit: 'entry_1',
  credit: 'entry_2',
  tax: 'entry_3',
};

export function getSlotMap(invoiceType: 'input' | 'output'): Record<string, string> {
  return invoiceType === 'input' ? INPUT_SLOT_MAP : OUTPUT_SLOT_MAP;
}
