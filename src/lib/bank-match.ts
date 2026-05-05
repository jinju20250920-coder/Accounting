import { useSubjectStore } from '@/stores/useSubjectStore';
import type { BankTransaction, Subject } from '@/types';

/**
 * Auto-match bank transactions to 1002 sub-subjects.
 * If no matching sub-subject exists, create one under 1002.
 * Returns the first matched/created bank subject ID.
 */
export async function autoMatchBankSubjects(
  transactions: BankTransaction[],
): Promise<string | null> {
  const { subjects, addSubject } = useSubjectStore.getState();

  const bankRoot = subjects.find(s => s.code === '1002');
  if (!bankRoot) return null;

  const accountMap = new Map<string, { accountNumber: string; branch: string }>();
  for (const tx of transactions) {
    if (tx.ourAccount && !accountMap.has(tx.ourAccount)) {
      accountMap.set(tx.ourAccount, {
        accountNumber: tx.ourAccount,
        branch: tx.ourBranch || '',
      });
    }
  }

  let firstMatchedId: string | null = null;

  for (const [accountNo, info] of accountMap) {
    const existing = subjects.find(
      s => s.parentId === bankRoot.id && s.bankAccountNumber === accountNo
    );

    if (existing) {
      if (!firstMatchedId) firstMatchedId = existing.id;
      continue;
    }

    const last4 = accountNo.slice(-4);
    const shortName = info.branch
      .replace(/^中国/, '')
      .replace(/股份有限公司.*/, '')
      .replace(/有限责任公司.*/, '')
      .slice(0, 6) || `银行${last4}`;

    const siblings = subjects.filter(s => s.parentId === bankRoot.id);
    const nextSeq = siblings.length + 1;
    const newCode = `1002${String(nextSeq).padStart(2, '0')}`;

    const newSubject: Omit<Subject, 'id'> = {
      code: newCode,
      name: shortName,
      parentId: bankRoot.id,
      level: 2,
      direction: 'debit' as const,
      enableDept: false,
      enableProject: false,
      enableForeign: false,
      isCustomer: false,
      isSupplier: false,
      isEmployee: false,
      enableCashFlow: true,
      disabled: false,
      block: false,
      subjectType: 'Asset',
      bankAccountNumber: accountNo,
    };

    await addSubject(newSubject);

    const updated = useSubjectStore.getState().subjects;
    const created = updated.find(s => s.code === newCode);
    if (created && !firstMatchedId) firstMatchedId = created.id;
  }

  return firstMatchedId;
}