import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Search, Users as UsersIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatusBadge from '@/components/ui/StatusBadge'
import ComposeMessage from '@/components/ui/ComposeMessage'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/formatters'
import clsx from 'clsx'

export default function Users() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [messageForm, setMessageForm] = useState({ channel: 'email', subject: '', message: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((res) => res.data),
  })

  const users = data?.users || []
  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.tenants?.name?.toLowerCase().includes(term)
    )
  })

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)))
    }
  }

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const [sendResult, setSendResult] = useState(null)

  const messageMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/communications', payload).then((res) => res.data),
    onSuccess: (data) => {
      setSendResult({ success: true, count: data.recipient_count })
      setMessageForm({ channel: 'email', subject: '', message: '' })
      setSelectedIds(new Set())
      setTimeout(() => {
        setIsMessageModalOpen(false)
        setSendResult(null)
      }, 2000)
    },
    onError: (err) => {
      setSendResult({ success: false, error: err.response?.data?.error || 'Failed to send message' })
    },
  })

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (selectedIds.size === 0) return
    if (!messageForm.message) return
    const showSubject = messageForm.channel === 'email' || messageForm.channel === 'both'
    if (showSubject && !messageForm.subject) return

    messageMutation.mutate({
      subject: messageForm.subject || `FlowFi Message — ${new Date().toLocaleDateString()}`,
      message: messageForm.message,
      channel: messageForm.channel,
      recipient_type: 'users',
      filters: { ids: Array.from(selectedIds) }
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="View and manage all individual user accounts across the platform."
        actions={
          <button
            type="button"
            onClick={() => setIsMessageModalOpen(true)}
            disabled={selectedIds.size === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Mail size={15} />
            Message Selected ({selectedIds.size})
          </button>
        }
      />

      <SectionCard>
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or tenant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description={searchTerm ? 'Try adjusting your search terms.' : 'No users exist yet.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-4 pl-4 pr-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="py-4 px-3">Name & Email</th>
                  <th className="py-4 px-3">Phone</th>
                  <th className="py-4 px-3">Tenant</th>
                  <th className="py-4 px-3">Role</th>
                  <th className="py-4 px-3">Joined</th>
                  <th className="py-4 px-3">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-4 pl-4 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-gray-500">{user.email}</div>
                    </td>
                    <td className="py-4 px-3">{user.phone || '-'}</td>
                    <td className="py-4 px-3">
                      {user.tenants?.name ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          {user.tenants.name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge status={user.role} />
                    </td>
                    <td className="py-4 px-3">{formatDateTime(user.created_at)}</td>
                    <td className="py-4 px-3 text-gray-500">{formatDateTime(user.updated_at) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Message Modal */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Message Selected Users</h2>
            <p className="text-sm text-gray-500 mb-6">
              Sending a message to {selectedIds.size} user{selectedIds.size === 1 ? '' : 's'}.
            </p>

              <form onSubmit={handleSendMessage} className="space-y-4">
              {/* result banner */}
              {sendResult && (
                <div className={`p-4 rounded-xl border flex gap-3 ${
                  sendResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {sendResult.success
                    ? <div className="text-green-600 shrink-0 text-xl font-bold">✓</div>
                    : <div className="text-red-600 shrink-0 text-xl font-bold">!</div>}
                  <div>
                    <p className="font-medium">{sendResult.success ? 'Message Sent Successfully' : 'Delivery Failed'}</p>
                    <p className="text-sm opacity-80 mt-1">
                      {sendResult.success ? `Delivered to ${sendResult.count} recipient(s)` : sendResult.error}
                    </p>
                  </div>
                </div>
              )}

              <ComposeMessage 
                channel={messageForm.channel} 
                setChannel={(ch) => setMessageForm({ ...messageForm, channel: ch })} 
                subject={messageForm.subject} 
                setSubject={(sub) => setMessageForm({ ...messageForm, subject: sub })} 
                message={messageForm.message} 
                setMessage={(msg) => setMessageForm({ ...messageForm, message: msg })} 
              />

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsMessageModalOpen(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={messageMutation.isPending}
                  className="btn-primary"
                >
                  {messageMutation.isPending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
