import { titleize } from '@/lib/formatters'

export const SHOP_ORDER_TRACK_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
export const SHOP_ORDER_STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

export const SHOP_ORDER_STATUS_COPY = {
  pending: 'Order logged and waiting for operational review.',
  confirmed: 'Payment is confirmed and the FlowFi team has accepted the order.',
  processing: 'The order is being prepared, packed, or coordinated for dispatch.',
  shipped: 'The order is on the move or has been handed to the courier.',
  delivered: 'The order has been delivered successfully.',
  cancelled: 'This order has been cancelled. Contact FlowFi if you need more help.',
}

export function getShopOrderStatusLabel(status) {
  return (
    {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    }[String(status || '').toLowerCase()] || titleize(status)
  )
}

export function getShopOrderStepIndex(status) {
  return SHOP_ORDER_TRACK_STEPS.indexOf(String(status || '').toLowerCase())
}
