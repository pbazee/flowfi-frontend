import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Send, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import ComposeMessage from '@/components/ui/ComposeMessage';

// ── main component ─────────────────────────────────────────────
const Communications = () => {
  const queryClient = useQueryClient();

  const [activeTab,     setActiveTab]     = useState('compose');
  const [subject,       setSubject]       = useState('');
  const [message,       setMessage]       = useState('');
  const [channel,       setChannel]       = useState('email');
  const [recipientType, setRecipientType] = useState('all');
  const [sendResult,    setSendResult]    = useState(null);

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['adminCommunicationLogs'],
    queryFn: () => api.get('/admin/communication-logs').then(r => r.data),
    enabled: activeTab === 'logs',
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/communications', payload).then(r => r.data),
    onSuccess: (data) => {
      setSendResult({ success: true, count: data.recipient_count });
      setSubject('');
      setMessage('');
      queryClient.invalidateQueries(['adminCommunicationLogs']);
    },
    onError: (err) => {
      setSendResult({
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to send message',
      });
    },
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!message) return;
    const showSubject = channel === 'email' || channel === 'both';
    if (showSubject && !subject) return;
    setSendResult(null);
    sendMutation.mutate({
      subject: subject || `FlowFi Message — ${new Date().toLocaleDateString()}`,
      message,
      channel,
      recipient_type: recipientType,
      filters: recipientType === 'all' ? {} : { status: recipientType },
    });
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-sm text-gray-500 mt-1">Send announcements and view communication history</p>
      </div>

      {/* tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-max">
        {[
          { id: 'compose', label: 'Compose Message', icon: Send },
          { id: 'logs',    label: 'Send History',    icon: Layers },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ── compose ── */}
      {activeTab === 'compose' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="p-6">
            <form onSubmit={handleSend} className="space-y-6 max-w-3xl">

              {/* result banner */}
              {sendResult && (
                <div className={`p-4 rounded-xl border flex gap-3 ${
                  sendResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {sendResult.success
                    ? <Send size={20} className="text-green-600 shrink-0" />
                    : <AlertCircle size={20} className="text-red-600 shrink-0" />}
                  <div>
                    <p className="font-medium">{sendResult.success ? 'Message Sent Successfully' : 'Delivery Failed'}</p>
                    <p className="text-sm opacity-80 mt-1">
                      {sendResult.success ? `Delivered to ${sendResult.count} recipient(s)` : sendResult.error}
                    </p>
                  </div>
                </div>
              )}

              {/* recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                <select
                  value={recipientType}
                  onChange={e => setRecipientType(e.target.value)}
                  className="w-full max-w-xs px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-colors"
                >
                  <option value="all">All Tenants</option>
                  <option value="active">Active Tenants Only</option>
                  <option value="trialing">Trialing Tenants Only</option>
                  <option value="suspended">Suspended Tenants Only</option>
                </select>
              </div>

              <ComposeMessage 
                channel={channel} 
                setChannel={setChannel} 
                subject={subject} 
                setSubject={setSubject} 
                message={message} 
                setMessage={setMessage} 
              />

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={sendMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {sendMutation.isPending
                    ? <><RefreshCw size={18} className="animate-spin" /> Sending…</>
                    : <><Send size={18} /> Send Message</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── logs ── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px] flex flex-col">
          {loadingLogs ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
          ) : !logs?.length ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <Layers className="text-gray-300 mb-3" size={28} />
              <p className="text-sm font-medium text-gray-900">No logs yet</p>
              <p className="text-sm text-gray-400 mt-1">Sent communications will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Date', 'Subject / Message', 'Channel', 'Recipients', 'Sent By'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(log.sent_at)}</td>
                      <td className="px-5 py-4 max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">{log.subject}</div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">{log.message}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          log.channel === 'email' ? 'bg-blue-50 text-blue-700' :
                          log.channel === 'sms'   ? 'bg-purple-50 text-purple-700' :
                                                    'bg-indigo-50 text-indigo-700'
                        }`}>
                          {log.channel?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.recipient_count}</div>
                        <div className="text-xs text-gray-400 capitalize">{log.recipient_type}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 max-w-[140px] truncate">{log.sent_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Communications;
