import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { MessageSquareText, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'

const initialForm = {
  reviewer_name: '',
  reviewer_email: '',
  reviewer_phone: '',
  reviewer_role: '',
  reviewer_company: '',
  rating: 5,
  message: '',
}

function ReviewStars({ rating }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={15} className={index < Number(rating || 0) ? 'fill-current' : ''} />
      ))}
    </div>
  )
}

export default function ReviewSection({
  scope,
  targetId,
  targetLabel,
  heading = 'Customer reviews',
  intro = 'See what other customers shared and leave your own review below.',
  emptyTitle = 'No reviews yet',
  emptyDescription = 'Be the first customer to share feedback here.',
  submitTitle = 'Write a review',
}) {
  const [form, setForm] = useState(initialForm)

  const { data: reviews = [], refetch } = useQuery({
    queryKey: ['public-reviews', scope, targetId],
    enabled: Boolean(scope && targetId),
    queryFn: () =>
      api
        .get('/platform/reviews', {
          params: {
            scope,
            target_id: targetId,
          },
        })
        .then((response) => response.data?.reviews || []),
  })

  const submitMutation = useMutation({
    mutationFn: (payload) => api.post('/platform/reviews', payload).then((response) => response.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Thanks for sharing your review.')
      setForm(initialForm)
      refetch()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not send your review right now')
    },
  })

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    submitMutation.mutate({
      ...form,
      scope,
      target_id: targetId,
      target_label: targetLabel,
    })
  }

  return (
    <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Reviews</p>
          <h2 className="mt-3 text-3xl font-bold text-gray-900">{heading}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-900">{intro}</p>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-gray-200 bg-gray-50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
              <MessageSquareText size={20} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{emptyTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-900">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                <ReviewStars rating={review.rating} />
                <p className="mt-4 text-base leading-8 text-gray-900">"{review.quote}"</p>
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="text-lg font-semibold text-gray-900">{review.name}</p>
                  {review.role ? <p className="mt-1 text-sm text-gray-900">{review.role}</p> : null}
                  {review.venue ? <p className="mt-1 text-sm font-medium text-primary-700">{review.venue}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
        <h3 className="text-2xl font-semibold text-gray-900">{submitTitle}</h3>
        <p className="mt-2 text-sm text-gray-900">
          Your feedback helps other customers understand what to expect.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Your name</label>
            <input
              value={form.reviewer_name}
              onChange={(event) => updateField('reviewer_name', event.target.value)}
              className="input"
              placeholder="Jane Mwangi"
              required
            />
          </div>
          <div>
            <label className="label">Rating</label>
            <select
              value={form.rating}
              onChange={(event) => updateField('rating', Number(event.target.value))}
              className="input"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={form.reviewer_email}
              onChange={(event) => updateField('reviewer_email', event.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              value={form.reviewer_phone}
              onChange={(event) => updateField('reviewer_phone', event.target.value)}
              className="input"
              placeholder="+254712345678"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <input
              value={form.reviewer_role}
              onChange={(event) => updateField('reviewer_role', event.target.value)}
              className="input"
              placeholder="Operations Lead"
            />
          </div>
          <div>
            <label className="label">Company or venue</label>
            <input
              value={form.reviewer_company}
              onChange={(event) => updateField('reviewer_company', event.target.value)}
              className="input"
              placeholder="Garden City Mall"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Review</label>
            <textarea
              value={form.message}
              onChange={(event) => updateField('message', event.target.value)}
              className="input min-h-32"
              placeholder="Tell other customers about your experience."
              required
            />
          </div>
        </div>

        <button type="submit" disabled={submitMutation.isPending} className="btn-primary mt-6 w-full">
          {submitMutation.isPending ? 'Sending review...' : 'Submit review'}
        </button>
      </form>
    </section>
  )
}
