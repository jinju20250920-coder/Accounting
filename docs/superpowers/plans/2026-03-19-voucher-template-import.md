# Voucher Template Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add template import functionality to voucher entry page with two loading options (with/without amounts) and fix voucher display to only show draft vouchers.

**Architecture:**
1. Add "Import Template" button to voucher entry page toolbar
2. Create template selection dialog with loading options
3. Add template loading methods to voucher store
4. Fix voucher entry page to only display draft vouchers

**Tech Stack:** Next.js 16, React, Zustand, Tailwind CSS, shadcn/ui

---

## Task 1: Fix Voucher Display Logic

**Goal:** Ensure voucher entry page only displays draft vouchers

**Files:**
- Read: `src/types/index.ts` (to understand Voucher type)
- Modify: `src/stores/useVoucherStore.ts` (add draft-only filtering)
- Read: `src/app/voucher-entry-page/page.tsx` (to understand current display logic)

### Task 1.1: Understand current voucher initialization

First, let's check what's happening when the page loads:

- [ ] **Step 1: Read the full voucher entry page**
  Read: `src/app/voucher-entry-page/page.tsx`
  Understand: How vouchers are currently being loaded and displayed

### Task 1.2: Modify voucher store to filter drafts

- [ ] **Step 1: Check current voucher store initialization**
  Read: `src/stores/useVoucherStore.ts` - look for `initialize` method and how vouchers are loaded

- [ ] **Step 2: Add draft-only filtering**
  In `src/stores/useVoucherStore.ts`, find where vouchers are loaded and add filtering.
  Look for `const vouchers = await databaseService.getAllVouchers();` and filter by status:
  ```typescript
  // Filter to only show draft vouchers
  const draftVouchers = vouchers.filter(v => v.status === 'draft');
  set({ vouchers: draftVouchers });
  ```

### Task 1.3: Verify the fix works

- [ ] **Step 1: Test the fix manually**
  Run the app, create a voucher, post it, then refresh the page - verify only draft vouchers appear

---

## Task 2: Add Template Import Button to Toolbar

**Files:**
- Modify: `src/components/voucher/voucher-entry-grid.tsx` (add button to toolbar)
- Read: `src/components/voucher/voucher-entry-grid.tsx` (find toolbar location)

### Task 2.1: Find the toolbar in voucher-entry-grid

- [ ] **Step 1: Read voucher-entry-grid and locate the toolbar**
  Read: `src/components/voucher/voucher-entry-grid.tsx`
  Look for where buttons like "保存" (Save), "入账" (Post) are located

### Task 2.2: Add the Import Template button

- [ ] **Step 1: Add Import Template button to toolbar**
  In `src/components/voucher/voucher-entry-grid.tsx`, find the toolbar section and add:
  ```typescript
  import { FileText } from 'lucide-react';

  // In the toolbar buttons area:
  <Button
    variant="outline"
    size="sm"
    onClick={handleImportTemplate}
  >
    <FileText className="w-4 h-4 mr-2" />
    导入模板
  </Button>
  ```
  Also add a state variable for the template dialog:
  ```typescript
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const handleImportTemplate = () => setShowTemplateDialog(true);
  ```

---

## Task 3: Create Template Selection Dialog

**Files:**
- Create: `src/components/voucher/TemplateSelector.tsx` (new component)
- Modify: `src/components/voucher/voucher-entry-grid.tsx` (integrate the dialog)
- Read: `src/stores/useVoucherTemplateStore.ts` (understand template data structure)

### Task 3.1: Create TemplateSelector component

- [ ] **Step 1: Create the TemplateSelector component**
  Create: `src/components/voucher/TemplateSelector.tsx`
  Content:
  ```typescript
  'use client';

  import React, { useState } from 'react';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
  import { Label } from '@/components/ui/label';
  import { useVoucherTemplateStore } from '@/stores';

  interface TemplateSelectorProps {
    open: boolean;
    onClose: () => void;
    onSelectTemplate: (templateId: string, loadAmounts: boolean) => void;
  }

  export function TemplateSelector({
    open,
    onClose,
    onSelectTemplate
  }: TemplateSelectorProps) {
    const { templates } = useVoucherTemplateStore();
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [loadAmounts, setLoadAmounts] = useState(false);

    const handleConfirm = () => {
      if (selectedTemplate) {
        onSelectTemplate(selectedTemplate, loadAmounts);
        onClose();
      }
    };

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择凭证模板</DialogTitle>
            <DialogDescription>
              选择一个模板来快速创建凭证
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {templates.map(template => (
                <button
                  key={template.id}
                  className={`w-full p-4 border rounded-lg text-left transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="font-medium">{template.name}</div>
                  {template.description && (
                    <div className="text-sm text-slate-500 mt-1">
                      {template.description}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-2">
                    {template.entries.length} 条分录
                  </div>
                </button>
              ))}
            </div>

            {/* Loading options */}
            <div className="border-t pt-4">
              <Label className="font-medium mb-2 block">加载选项</Label>
              <RadioGroup
                defaultValue="no-amounts"
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="no-amounts"
                    id="no-amounts"
                    onClick={() => setLoadAmounts(false)}
                  />
                  <Label htmlFor="no-amounts">
                    不加载金额（仅加载摘要、科目、部门、项目等）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="with-amounts"
                    id="with-amounts"
                    onClick={() => setLoadAmounts(true)}
                  />
                  <Label htmlFor="with-amounts">
                    完全加载（加载所有信息，包括金额）
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedTemplate}
            >
              确认导入
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  ```

### Task 3.2: Integrate TemplateSelector into voucher-entry-grid

- [ ] **Step 1: Add TemplateSelector to voucher-entry-grid**
  In `src/components/voucher/voucher-entry-grid.tsx`:
  ```typescript
  // Add import at top:
  import { TemplateSelector } from './TemplateSelector';

  // Add the dialog component near the end of the component:
  <TemplateSelector
    open={showTemplateDialog}
    onClose={() => setShowTemplateDialog(false)}
    onSelectTemplate={handleTemplateSelected}
  />
  ```

---

## Task 4: Add Template Loading Logic to Voucher Store

**Files:**
- Modify: `src/stores/useVoucherStore.ts` (add `loadTemplate` method)
- Read: `src/types/index.ts` (understand VoucherTemplateEntry type)

### Task 4.1: Understand VoucherTemplateEntry type

- [ ] **Step 1: Read types file**
  Read: `src/types/index.ts`
  Look for: `VoucherFullTemplate` and `VoucherTemplateEntry` interfaces

### Task 4.2: Add loadTemplate method to useVoucherStore

- [ ] **Step 1: Add loadTemplate method**
  In `src/stores/useVoucherStore.ts`, add:
  ```typescript
  loadTemplate: (template: any, loadAmounts: boolean) => {
    const state = get();

    // Create new entries from template
    const newEntries = template.entries.map((entry: any, index: number) => ({
      id: `entry-${Date.now()}-${index}`,
      voucherId: '',
      date: state.voucherDate,
      summary: entry.summary || '',
      subjectCode: entry.subjectCode || '',
      subjectName: entry.subjectName || '',
      deptCode: entry.deptCode || '',
      projectCode: entry.projectCode || '',
      debit: loadAmounts ? (entry.debit || 0) : 0,
      credit: loadAmounts ? (entry.credit || 0) : 0,
      auxiliary: {
        department: entry.deptCode || '',
        project: entry.projectCode || '',
        customer: entry.customerName || '',
        supplier: entry.supplierName || ''
      }
    }));

    // Ensure we have at least 10 rows
    while (newEntries.length < 10) {
      newEntries.push({
        id: `entry-${Date.now()}-${newEntries.length}`,
        voucherId: '',
        date: state.voucherDate,
        summary: '',
        subjectCode: '',
        subjectName: '',
        deptCode: '',
        projectCode: '',
        debit: 0,
        credit: 0,
        auxiliary: {}
      });
    }

    set({
      currentEntries: newEntries,
      voucherNo: generateVoucherNo(state.voucherDate),
      currentVoucher: null,
      totalDebit: newEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0),
      totalCredit: newEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0),
      isBalanced: false
    });
  }
  ```
  Also add this method to the `VoucherStore` interface.

### Task 4.3: Add handleTemplateSelected to voucher-entry-grid

- [ ] **Step 1: Add handleTemplateSelected function**
  In `src/components/voucher/voucher-entry-grid.tsx`:
  ```typescript
  const handleTemplateSelected = (templateId: string, loadAmounts: boolean) => {
    const template = useVoucherTemplateStore.getState().getTemplate(templateId);
    if (template) {
      useVoucherStore.getState().loadTemplate(template, loadAmounts);
      toast({
        title: "模板加载成功",
        description: loadAmounts ? "已完全加载模板（含金额）" : "已加载模板（不含金额）"
      });
    }
  };
  ```

---

## Task 5: Integration and Testing

**Files:**
- Test: Run the app and test all features

### Task 5.1: Test draft-only display

- [ ] **Step 1: Create a voucher and post it**
  - Go to voucher entry page
  - Create a new voucher
  - Post it (change status to posted)

- [ ] **Step 2: Refresh and verify**
  - Refresh the page
  - Verify only draft vouchers are displayed
  - Verify posted vouchers are NOT displayed

### Task 5.2: Test template import

- [ ] **Step 1: Create a test template**
  - Go to `/settings/templates`
  - Create a test template with sample entries and amounts

- [ ] **Step 2: Import template without amounts**
  - Go to voucher entry page
  - Click "导入模板"
  - Select the test template
  - Choose "不加载金额"
  - Verify entries load, but amounts are 0

- [ ] **Step 3: Import template with amounts**
  - Click "导入模板" again
  - Select the test template
  - Choose "完全加载"
  - Verify entries and amounts load correctly

### Task 5.3: Commit changes

- [ ] **Step 1: Commit all changes**
  ```bash
  git add src/components/voucher/TemplateSelector.tsx
  git add src/components/voucher/voucher-entry-grid.tsx
  git add src/stores/useVoucherStore.ts
  git add docs/superpowers/plans/2026-03-19-voucher-template-import.md
  git commit -m "feat: add template import to voucher entry page"
  ```

---

## Verification Checklist

- [ ] Only draft vouchers appear on voucher entry page
- [ ] "导入模板" button is visible in toolbar
- [ ] Clicking button shows template selection dialog
- [ ] Template list displays all available templates
- [ ] "不加载金额" option loads everything except debit/credit amounts
- [ ] "完全加载" option loads all template data including amounts
- [ ] After importing, user can edit the voucher
- [ ] Success toast is shown after import

## Success Criteria

1. User can import templates with or without amounts
2. Only draft vouchers are visible on voucher entry page
3. User experience is smooth with proper feedback
4. No regression in existing functionality
