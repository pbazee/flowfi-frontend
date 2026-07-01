import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import RichTextEditor from '@/components/ui/RichTextEditor'
import api from '@/lib/api'
import clsx from 'clsx'

export default function Legal() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('terms')
  const [content, setContent] = useState({})
  const [faqs, setFaqs] = useState([])

  const { data: pages = [], isLoading: isLoadingPages } = useQuery({
    queryKey: ['admin-legal'],
    queryFn: () => api.get('/admin/legal').then((res) => res.data),
  })

  const { data: fetchedFaqs = [], isLoading: isLoadingFaqs } = useQuery({
    queryKey: ['admin-faqs'],
    queryFn: () => api.get('/admin/faqs').then((res) => res.data),
  })

  useEffect(() => {
    if (pages.length > 0) {
      const initialContent = {}
      pages.forEach((page) => {
        initialContent[page.slug] = page.content || ''
      })
      setContent(initialContent)
      if (!pages.some((p) => p.slug === activeTab) && activeTab !== 'faqs') {
        setActiveTab(pages[0].slug)
      }
    }
  }, [pages])

  useEffect(() => {
    setFaqs(fetchedFaqs)
  }, [fetchedFaqs])

  const saveMutation = useMutation({
    mutationFn: ({ slug, title, htmlContent }) =>
      api.put(`/admin/legal/${slug}`, { title, content: htmlContent }).then((res) => res.data),
    onSuccess: () => {
      toast.success('Legal page updated')
      queryClient.invalidateQueries({ queryKey: ['admin-legal'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update page')
    },
  })

  const createFaqMutation = useMutation({
    mutationFn: (newFaq) => api.post('/admin/faqs', newFaq).then((res) => res.data),
    onSuccess: () => {
      toast.success('FAQ added')
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] })
    },
  })

  const updateFaqMutation = useMutation({
    mutationFn: (faq) => api.put(`/admin/faqs/${faq.id}`, faq).then((res) => res.data),
    onSuccess: () => {
      toast.success('FAQ updated')
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] })
    },
  })

  const deleteFaqMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/faqs/${id}`).then((res) => res.data),
    onSuccess: () => {
      toast.success('FAQ deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] })
    },
  })

  const handleSaveLegalPage = () => {
    const activePage = pages.find((p) => p.slug === activeTab)
    if (!activePage) return

    saveMutation.mutate({
      slug: activeTab,
      title: activePage.title,
      htmlContent: content[activeTab] || '',
    })
  }

  const addFaq = () => {
    createFaqMutation.mutate({
      question: 'New Question',
      answer: 'New Answer',
      display_order: faqs.length,
      is_active: true,
    })
  }

  const activePage = pages.find((p) => p.slug === activeTab)

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Public Site"
        title="Legal & FAQs"
        description="Manage the terms of service, privacy policy, and FAQs shown on the public website."
        actions={
          activeTab !== 'faqs' ? (
            <button
              type="button"
              onClick={handleSaveLegalPage}
              disabled={isLoadingPages || saveMutation.isPending || !activePage}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          ) : (
            <button type="button" onClick={addFaq} className="btn-primary flex items-center gap-2">
              <Plus size={15} />
              Add FAQ
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        {/* Sidebar Tabs */}
        <div className="space-y-1">
          {pages.map((page) => (
            <button
              key={page.slug}
              onClick={() => setActiveTab(page.slug)}
              className={clsx(
                'w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                activeTab === page.slug
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {page.title}
            </button>
          ))}
          {/* Static FAQs tab */}
          <button
            onClick={() => setActiveTab('faqs')}
            className={clsx(
              'w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
              activeTab === 'faqs'
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            FAQs
          </button>

          {isLoadingPages && (
            <div className="animate-pulse space-y-2">
              <div className="h-10 rounded-xl bg-gray-200" />
              <div className="h-10 rounded-xl bg-gray-200" />
            </div>
          )}
        </div>

        {/* Editor Area */}
        <div className="md:col-span-3">
          {activeTab === 'faqs' ? (
            <SectionCard title="Frequently Asked Questions" description="Manage the Q&A list shown on the landing page and FAQ page.">
              {isLoadingFaqs ? (
                <div className="flex h-64 items-center justify-center text-gray-400">Loading FAQs...</div>
              ) : (
                <div className="mt-4 space-y-4">
                  {faqs.map((faq, index) => (
                    <div key={faq.id} className="flex gap-4 rounded-xl border border-gray-100 p-4">
                      <div className="mt-2 text-gray-400">
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => {
                            const newFaqs = [...faqs]
                            newFaqs[index].question = e.target.value
                            setFaqs(newFaqs)
                          }}
                          onBlur={() => updateFaqMutation.mutate(faqs[index])}
                          className="input w-full font-semibold"
                          placeholder="Question"
                        />
                        <textarea
                          value={faq.answer}
                          onChange={(e) => {
                            const newFaqs = [...faqs]
                            newFaqs[index].answer = e.target.value
                            setFaqs(newFaqs)
                          }}
                          onBlur={() => updateFaqMutation.mutate(faqs[index])}
                          rows={3}
                          className="input w-full"
                          placeholder="Answer"
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => deleteFaqMutation.mutate(faq.id)}
                          className="btn-outline border-red-100 p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {faqs.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-500">
                      No FAQs exist yet. Click "Add FAQ" to get started.
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard
              title={activePage?.title || 'Loading...'}
              description={`Editing the public /legal/${activeTab} page`}
            >
              {activePage ? (
                <div className="mt-4">
                  <RichTextEditor
                    value={content[activeTab] || ''}
                    onChange={(html) => setContent((prev) => ({ ...prev, [activeTab]: html }))}
                  />
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-gray-400">
                  {isLoadingPages ? 'Loading content...' : 'Page not found'}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}
