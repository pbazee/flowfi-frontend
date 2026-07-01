import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, Navigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PublicShell from '@/components/public/PublicShell'
import api from '@/lib/api'

function FaqAccordion({ faqs }) {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div className="space-y-3">
      {faqs.map((faq, idx) => (
        <div key={faq.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <span className="font-semibold text-gray-900">{faq.question}</span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                openIndex === idx ? 'rotate-180' : ''
              }`}
            />
          </button>
          <AnimatePresence initial={false}>
            {openIndex === idx && (
              <motion.div
                key="content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-5 text-sm leading-relaxed text-gray-600">{faq.answer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

export default function LegalPage() {
  const { slug } = useParams()
  const isFaqs = slug === 'faqs'

  const { data: page, isLoading: pageLoading, error: pageError } = useQuery({
    queryKey: ['public-legal', slug],
    queryFn: () => api.get(`/platform/legal/${slug}`).then((res) => res.data),
    retry: false,
    enabled: !isFaqs,
  })

  const { data: faqs = [], isLoading: faqsLoading } = useQuery({
    queryKey: ['public-faqs'],
    queryFn: () => api.get('/platform/faqs').then((res) => res.data),
    enabled: isFaqs,
  })

  const isLoading = isFaqs ? faqsLoading : pageLoading

  if (isLoading) {
    return (
      <PublicShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      </PublicShell>
    )
  }

  if (!isFaqs && (pageError || !page)) {
    return <Navigate to="/" replace />
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {isFaqs ? (
          <>
            <h1 className="mb-4 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Frequently Asked Questions
            </h1>
            <p className="mb-10 text-lg text-gray-500">
              Everything you need to know about FlowFi. Can't find your answer?{' '}
              <a href="/contact" className="font-medium text-primary-600 hover:underline">
                Contact us →
              </a>
            </p>
            {faqs.length > 0 ? (
              <FaqAccordion faqs={faqs} />
            ) : (
              <p className="text-center text-gray-400">No FAQs available yet.</p>
            )}
          </>
        ) : (
          <>
            <h1 className="mb-8 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {page.title}
            </h1>
            <div
              className="prose prose-lg prose-primary max-w-none prose-headings:font-display"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
            <div className="mt-16 border-t border-gray-100 pt-8 text-sm text-gray-500">
              Last updated: {new Date(page.updated_at).toLocaleDateString()}
            </div>
          </>
        )}
      </div>
    </PublicShell>
  )
}
