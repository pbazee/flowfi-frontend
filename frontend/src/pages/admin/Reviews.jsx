import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Quote, Save, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAdminContentSettings } from '@/hooks/useAdminContentSettings'
import api from '@/lib/api'
import { formatNumber } from '@/lib/formatters'

export default function Reviews() {
  const queryClient = useQueryClient()
  const {
    form,
    isLoading,
    saveMutation,
    updateReview,
    addReview,
    removeReview,
    saveSettings,
  } = useAdminContentSettings()

  const averageRating = form.reviews.length
    ? (form.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / form.reviews.length).toFixed(1)
    : '0.0'

  const { data: submissions = [] } = useQuery({
    queryKey: ['admin-review-submissions'],
    queryFn: () => api.get('/admin/review-submissions').then((response) => response.data || []),
  })

  const pendingSubmissions = submissions.filter((submission) => submission.status === 'pending').length
  const publishedSubmissions = submissions.filter((submission) => submission.status === 'published').length

  const submissionMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/admin/review-submissions/${id}`, { status }).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-review-submissions'] })
      toast.success('Review submission updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Could not update the review submission')
    },
  })

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Public Content"
        title="Customer reviews"
        description="Manage testimonials shown on the landing page and the full reviews page."
        actions={(
          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save reviews'}
          </button>
        )}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Published reviews" value={formatNumber(form.reviews.length)} icon={Quote} />
        <StatTile label="Average rating" value={`${averageRating} / 5`} icon={Star} tone="green" />
        <StatTile label="Pending submissions" value={formatNumber(pendingSubmissions)} icon={Quote} tone="blue" />
      </div>

      <SectionCard
        title="Review library"
        description="Add, edit, and remove social proof for the public site."
        action={(
          <button type="button" onClick={addReview} className="btn-outline flex items-center gap-2">
            <Plus size={14} />
            Add review
          </button>
        )}
      >
        <div className="space-y-5">
          {form.reviews.map((review, index) => (
            <div key={review.id} className="rounded-3xl border border-gray-100 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Review #{index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{review.name || 'Unnamed reviewer'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => removeReview(review.id)}
                  className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Reviewer name</label>
                  <input
                    value={review.name}
                    onChange={(event) => updateReview(review.id, 'name', event.target.value)}
                    className="input"
                    placeholder="Mercy Njeri"
                  />
                </div>
                <div>
                  <label className="label">Venue</label>
                  <input
                    value={review.venue}
                    onChange={(event) => updateReview(review.id, 'venue', event.target.value)}
                    className="input"
                    placeholder="Sarova Hotels"
                  />
                </div>
                <div>
                  <label className="label">Role</label>
                  <input
                    value={review.role}
                    onChange={(event) => updateReview(review.id, 'role', event.target.value)}
                    className="input"
                    placeholder="Guest Experience Manager"
                  />
                </div>
                <div>
                  <label className="label">Rating</label>
                  <select
                    value={review.rating}
                    onChange={(event) => updateReview(review.id, 'rating', Number(event.target.value))}
                    className="input"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} / 5
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="label">Quote</label>
                <textarea
                  value={review.quote}
                  onChange={(event) => updateReview(review.id, 'quote', event.target.value)}
                  className="input min-h-24"
                  placeholder="What changed for this venue after using FlowFi?"
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        className="mt-8"
        title="Customer-submitted reviews"
        description="Moderate reviews sent from the public reviews, shop product, and service pages."
      >
        {submissions.length === 0 ? (
          <EmptyState
            icon={Quote}
            title="No submitted reviews yet"
            description="New customer reviews will appear here after they are sent from the public site."
          />
        ) : (
          <div className="space-y-5">
            {submissions.map((submission) => (
              <div key={submission.id} className="rounded-3xl border border-gray-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{submission.name}</h3>
                      <StatusBadge status={submission.status} />
                      <StatusBadge tone="info">{submission.scope}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-gray-900">
                      {submission.target_label || submission.target_id}
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {submission.role || 'Customer'}{submission.venue ? ` • ${submission.venue}` : ''}
                    </p>
                    {submission.email ? <p className="mt-1 text-sm text-gray-900">{submission.email}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{submission.rating} / 5</p>
                    <p className="mt-1 text-xs text-gray-500">{submission.created_at?.slice(0, 10)}</p>
                  </div>
                </div>

                <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-900">
                  {submission.quote}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {['published', 'pending', 'rejected'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => submissionMutation.mutate({ id: submission.id, status })}
                      disabled={submissionMutation.isPending && submissionMutation.variables?.status === status}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        submission.status === status
                          ? 'border-primary-300 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-primary-200'
                      }`}
                    >
                      Mark as {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {publishedSubmissions > 0 ? (
          <p className="mt-5 text-sm text-gray-900">
            {formatNumber(publishedSubmissions)} customer-submitted review{publishedSubmissions === 1 ? '' : 's'} currently published.
          </p>
        ) : null}
      </SectionCard>
    </div>
  )
}
