import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import api from '@/lib/api'

const initialForm = {
  name: '',
  email: '',
  phone: '',
  message: '',
}

export default function ContactPage() {
  const { data: content } = usePlatformContent()
  const contact = content?.contact
  const [form, setForm] = useState(initialForm)

  const contactMutation = useMutation({
    mutationFn: (payload) => api.post('/platform/contact-messages', payload).then((response) => response.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Message sent')
      setForm(initialForm)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not send your message')
    },
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    contactMutation.mutate(form)
  }

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Contact us</p>
              <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">Let&apos;s plan your rollout</h1>
              <p className="mt-4 text-lg leading-relaxed text-gray-900">
                {contact?.intro}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Phone</p>
                <p className="mt-2 text-base font-semibold text-gray-900">{contact?.phone || 'Not set'}</p>
              </div>
              <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Email</p>
                <p className="mt-2 text-base font-semibold text-gray-900">{contact?.email || 'Not set'}</p>
              </div>
              <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">WhatsApp</p>
                <a
                  href={`https://wa.me/${String(contact?.whatsapp || '').replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-base font-semibold text-primary-700 hover:underline"
                >
                  {contact?.whatsapp || 'Not set'}
                </a>
              </div>
              <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Address</p>
                <p className="mt-2 text-base font-semibold text-gray-900">{contact?.address || 'Not set'}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">Send a message</h2>
            <p className="mt-2 text-sm text-gray-900">
              Ask about workspace plans, hardware, managed support, or a custom deployment.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Your name</label>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="input"
                  placeholder="Jane Mwangi"
                  required
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className="input"
                  placeholder="+254712345678"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="input"
                  placeholder="ops@yourvenue.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Message</label>
                <textarea
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  className="input min-h-40"
                  placeholder="Tell us what you're planning and how FlowFi can help."
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={contactMutation.isPending} className="btn-primary mt-6 w-full">
              {contactMutation.isPending ? 'Sending message...' : 'Send message'}
            </button>
          </form>
        </div>
      </section>
    </PublicShell>
  )
}
