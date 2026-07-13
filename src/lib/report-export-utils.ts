/**
 * Shared handle for report components to expose their structured data
 * to the parent page for export/print operations.
 *
 * Each report component should be wrapped in forwardRef and use useImperativeHandle
 * to expose this interface. The parent page (src/app/reports/page.tsx) wires
 * the 刷新/打印/导出 buttons via refs.
 */
export interface ReportHandle {
  /**
   * Return rows keyed by display label for exportToExcel.
   * Each row is a flat object suitable for json_to_sheet.
   */
  getExportRows: () => Record<string, unknown>[];
  /** Sheet/file name base, e.g. "科目余额表". Parent appends nothing — exportToExcel adds .xlsx. */
  getSheetName: () => string;
}
