import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, DollarSign, Receipt, Search, Smartphone } from 'lucide-react'
import api from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters'

export default function Transactions() {
  const [methodFilter, setMethodFilter] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 50

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-transactions', methodFilter, page],
    queryFn: () =>
      api
        .get('/tenant/transactions', {
          params: {
            method: methodFilter || undefined,
            page,
            limit,
          },
        })
        .then((response) => response.data),
  })

  const transactions = data?.transactions || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const visibleTransactions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return transactions

    return transactions.filter((transaction) => {
      const haystack = [
        transaction.reference,
        transaction.phone,
        transaction.customer_email,
        transaction.payment_method,
        transaction.packages?.name,
        transaction.mpesa_receipt,
        transaction.gateway_ref,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [search, transactions])

  const successCount = transactions.filter((transaction) => transaction.status === 'success').length
  const pendingCount = transactions.filter((transaction) => transaction.status === 'pending').length
  const failedCount = transactions.filter((transaction) => transaction.status === 'failed').length
  const totalVolume = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Revenue"
        title="Transactions"
        description="Review payment activity across M-Pesa and Paystack, reconcile references, and spot failed checkouts fast."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Loaded volume" value={formatCurrency(totalVolume)} icon={DollarSign} />
        <StatTile label="Successful" value={formatNumber(successCount)} icon={Receipt} tone="green" />
        <StatTile label="Pending" value={formatNumber(pendingCount)} icon={Smartphone} tone="amber" />
        <StatTile label="Failed" value={formatNumber(failedCount)} icon={CreditCard} tone="blue" />
      </div>

      <SectionCard
        title="Payment ledger"
        description="Search by reference, phone, gateway identifier, or customer email."
      >
        <div className="mb-5 grid gap-3 lg:grid-cols-[1.2fr,0.7fr,auto]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input pl-9"
              placeholder="Search reference, receipt, phone, email..."
            />
          </div>

          <select
            value={methodFilter}
            onChange={(event) => {
              setMethodFilter(event.target.value)
              setPage(1)
            }}
            className="input"
          >
            <option value="">All payment methods</option>
            <option value="mpesa">M-Pesa</option>
            <option value="paystack">Paystack</option>
          </select>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
            {formatNumber(total)} total transactions
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : visibleTransactions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No transactions found"
            description="Try another filter combination or wait for new payment activity to come in."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Reference</th>
                  <th className="pb-3 pr-4 font-medium">Customer</th>
                  <th className="pb-3 pr-4 font-medium">Package</th>
                  <th className="pb-3 pr-4 font-medium">Method</th>
                  <th className="pb-3 pr-4 font-medium">Amount</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleTransactions.map((transaction) => (
                  <tr key={transaction.id} className="align-top">
                    <td className="py-4 pr-4">
                      <p className="text-sm font-semibold text-gray-900">{transaction.reference}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {transaction.mpesa_receipt || transaction.gateway_ref || 'No gateway reference'}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-600">
                      <p className="font-medium text-gray-900">{transaction.phone || 'No phone captured'}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {transaction.customer_email || 'No email captured'}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-sm text-gray-600">
                      {transaction.packages?.name || 'Custom package'}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge tone="info">{transaction.payment_method?.toUpperCase() || 'UNKNOWN'}</StatusBadge>
                    </td>
                    <td className="py-4 pr-4 text-sm font-semibold text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={transaction.status} />
                    </td>
                    <td className="py-4 text-sm text-gray-500">
                      <p>{formatDateTime(transaction.created_at)}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {transaction.paid_at ? `Paid ${formatDateTime(transaction.paid_at)}` : 'Awaiting payment confirmation'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="btn-outline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
