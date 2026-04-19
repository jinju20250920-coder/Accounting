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
  SmartRuleAction,
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

function evaluateCondition(
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

function evaluateConditions(
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
    unit: invoice.unit || '台',
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
  _strategy: AuxiliaryStrategyConfig | null,
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
  } = context;

  // No rule matched — return empty defaults
  if (!matchedRule) {
    return {
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
  }

  const subjectOverrides: Record<string, { code: string; name: string }> = {};
  let auxiliaryResult: AuxiliaryResult | null = null;
  let markCategory: 'purchase' | 'reimbursement' | 'fixed_asset' | null = null;
  let fixedAssetCard: Omit<FixedAsset, 'id' | 'createTime' | 'updateTime'> | null = null;
  let reimburserName: string | null = null;
  const partnerCreated = false;

  for (const action of matchedRule.actions) {
    switch (action.type) {
      case 'overrideSubject': {
        const oa = action as OverrideSubjectAction;
        subjectOverrides[oa.slot] = { code: oa.subjectCode, name: oa.subjectName };
        break;
      }
      case 'supplierSubject': {
        const sa = action as SupplierSubjectAction;
        const supplierOverrides = resolveSupplierSubject(invoice, sa, supplierMappings);
        // Supplier overrides have lower priority than direct overrides
        for (const [slot, val] of Object.entries(supplierOverrides)) {
          if (!subjectOverrides[slot]) {
            subjectOverrides[slot] = val;
          }
        }
        break;
      }
      case 'reimbursementSubject': {
        const ra = action as ReimbursementSubjectAction;
        const result = resolveReimbursement(invoice, ra, expenseReimbursements);
        if (result.creditOverride) {
          subjectOverrides['credit'] = result.creditOverride; // highest priority
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
        const assetCode = generateAssetCode(context.assetMappings.map((m) => m.id));
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
