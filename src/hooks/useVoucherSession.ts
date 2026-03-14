import { useVoucherStore } from '../stores/useVoucherStore'

export function useVoucherSession() {
  const {
    vouchers,
    currentVoucher,
    setActiveVoucher,
    createVoucher,
    copyVoucher,
    deleteVoucher,
    saveVoucherAndCreateNext
  } = useVoucherStore()

  // Get voucher statistics for the session
  const sessionStats = {
    total: vouchers.length,
    draft: vouchers.filter(v => v.status === 'draft').length,
    review: vouchers.filter(v => v.status === 'review').length,
    posted: vouchers.filter(v => v.status === 'posted').length,
    reversed: vouchers.filter(v => v.status === 'reversed').length
  }

  // Get the next available voucher number
  const getNextVoucherNumber = () => {
    const today = new Date().toISOString().split('T')[0]
    const todayVouchers = vouchers.filter(v => v.date === today)
    return todayVouchers.length + 1
  }

  // Check if any vouchers have unsaved changes
  const hasUnsavedChanges = vouchers.some(v => v.status === 'draft' && v.id === currentVoucher?.id)

  return {
    vouchers,
    currentVoucher,
    sessionStats,
    getNextVoucherNumber,
    hasUnsavedChanges,
    setActiveVoucher,
    createVoucher,
    copyVoucher,
    deleteVoucher,
    saveVoucherAndCreateNext
  }
}