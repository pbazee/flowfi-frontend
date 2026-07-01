import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail, MessageSquareText, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import api from '@/lib/api'
import { formatDateTime, formatNumber } from '@/lib/formatters'

const statuses = ['new', 'read', 'resolved']

export default function Messages() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedMessage, setSelectedMessage] = useState(null)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['admin-messages', statusFilter],
    queryFn: () =>
      api
        .get('/admin/messages', {
          params: {
            status: statusFilter || undefined,
          },
        })
        .then((response) => response.data || []),
  })

  useEffect(() => {
    if (!selectedMessage && messages.length > 0) {
      setSelectedMessage(messages[0])
      return
    }

    if (!selectedMessage) return
    const refreshed = messages.find((message) => message.id === selectedMessage.id)
    if (refreshed) {
      setSelectedMessage(refreshed)
    }
  }, [messages, selectedMessage])

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/admin/messages/${id}`, { status }).then((response) => response.data),
    onSuccess: (updatedMessage) => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] })
      setSelectedMessage(updatedMessage)
      toast.success('Message updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not update the message')
    },
  })

  const totalMessages = messages.length
  const unreadMessages = messages.filter((message) => message.status === 'new').length
  const resolvedMessages = messages.filter((message) => message.status === 'resolved').length
  const latestMessage = useMemo(() => messages[0], [messages])

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Platform Inbox"
        title="Contact messages"
        description="Read every message sent from the public contact form and track which ones still need follow-up."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Loaded messages" value={formatNumber(totalMessages)} icon={Inbox} />
        <StatTile label="New" value={formatNumber(unreadMessages)} icon={Mail} tone="amber" />
        <StatTile label="Resolved" value={formatNumber(resolvedMessages)} icon={MessageSquareText} tone="green" />
        <StatTile
          label="Latest"
          value={latestMessage ? formatDateTime(latestMessage.created_at) : 'No messages'}
          icon={Phone}
          tone="blue"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,0.95fr]">
        <SectionCard
          title="Inbox"
          description="Pick a message to see the full details."
          action={(
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input min-w-[180px]"
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
        >
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No messages yet"
              description="When customers write through the public contact page, their messages will appear here."
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => setSelectedMessage(message)}
                  className={`w-full rounded-3xl border p-5 text-left transition-colors ${
                    selectedMessage?.id === message.id
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-gray-100 hover:border-primary-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{message.name}</h3>
                        <StatusBadge status={message.status} />
                      </div>
                      <p className="mt-2 text-sm text-gray-900">{message.email || 'No email provided'}</p>
                      {message.phone ? <p className="mt-1 text-sm text-gray-900">{message.phone}</p> : null}
                    </div>
                    <p className="text-xs text-gray-500">{formatDateTime(message.created_at)}</p>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-gray-900">{message.message}</p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Message detail"
          description="Use the status to track whether the team has handled the request."
        >
          {!selectedMessage ? (
            <EmptyState
              icon={MessageSquareText}
              title="Pick a message"
              description="Select an inbox item to read it in full."
            />
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gray-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-semibold text-gray-900">{selectedMessage.name}</h3>
                      <StatusBadge status={selectedMessage.status} />
                    </div>
                    {selectedMessage.email ? <p className="mt-3 text-sm text-gray-900">{selectedMessage.email}</p> : null}
                    {selectedMessage.phone ? <p className="mt-1 text-sm text-gray-900">{selectedMessage.phone}</p> : null}
                  </div>
                  <p className="text-xs text-gray-500">{formatDateTime(selectedMessage.created_at)}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Message</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-900">
                  {selectedMessage.message}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {statuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => statusMutation.mutate({ id: selectedMessage.id, status })}
                    disabled={statusMutation.isPending && statusMutation.variables?.status === status}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      selectedMessage.status === status
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-900 hover:border-primary-200'
                    }`}
                  >
                    Mark as {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
