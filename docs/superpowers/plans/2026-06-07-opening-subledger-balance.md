# Opening Subledger Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit opening balance adjustment and subledger mismatch visibility to account-set initialization.

**Architecture:** Put accounting calculations in a small pure helper, keep React responsible for state and rendering. The helper returns total debit/credit, adjustment direction, and subledger differences for the page to display and for save logic to consume.

**Tech Stack:** TypeScript, React, existing account-set setup components, existing shell-based TypeScript test scripts.

---

### Task 1: Opening Balance Rule Helper

**Files:**
- Create: `src/lib/opening-balance-rules.ts`
- Create: `test-opening-balance-rules.ts`

- [ ] Write failing tests for explicit adjustment and subledger mismatch calculations.
- [ ] Run the test and confirm missing helper failure.
- [ ] Implement the helper.
- [ ] Run the test and confirm pass.

### Task 2: Setup Step Integration

**Files:**
- Modify: `src/components/account-set/setup-step-opening.tsx`

- [ ] Import the helper.
- [ ] Derive balance analysis from subject, partner, bank, and asset entries.
- [ ] Add an explicit adjustment subject selector in the subject tab when total debit and credit differ.
- [ ] Show subledger mismatch warnings separately from total balance warnings.
- [ ] Add the adjustment entry during save only when the user selected a subject.

### Task 3: Verification

**Files:**
- Existing project files

- [ ] Run focused opening-balance rule test.
- [ ] Run ESLint for changed TypeScript/React files.
- [ ] Run `tsc --project tsconfig.json --noEmit`.

