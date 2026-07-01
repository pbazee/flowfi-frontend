import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import ReviewSection from '@/components/public/ReviewSection'
import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'

function ReviewStars({ rating }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} size={15} className={index < Number(rating || 0) ? 'fill-current' : ''} />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const { data: content } = usePlatformContent()
  const reviews = content?.reviews || []
  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : '0.0'

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Reviews</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">What venue teams say about FlowFi</h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-900">
            These testimonials are curated from the FlowFi workspace and help explain how the platform performs in real venue operations.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Published reviews</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{reviews.length}</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Average rating</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{averageRating} / 5</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Focus</p>
            <p className="mt-2 text-xl font-semibold text-gray-900">Rollout, payments, and operations</p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
              <ReviewStars rating={review.rating} />
              <p className="mt-5 text-base leading-8 text-gray-900">"{review.quote}"</p>
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="text-lg font-semibold text-gray-900">{review.name}</p>
                <p className="mt-1 text-sm text-gray-900">{review.role || 'Venue team member'}</p>
                <p className="mt-1 text-sm font-medium text-primary-700">{review.venue || 'FlowFi customer'}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-[28px] bg-primary-600 px-8 py-10 text-white">
          <h2 className="text-3xl font-bold">Ready to build your own FlowFi rollout?</h2>
          <p className="mt-3 max-w-2xl text-primary-100">
            Talk to the team about your venue, rollout timeline, and the best way to combine software, payments, hardware, and support.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/contact" className="rounded-xl bg-white px-5 py-3 font-semibold text-primary-800 shadow-sm transition-colors hover:bg-primary-50">
              Contact FlowFi
            </Link>
            <Link to="/register" className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10">
              Start a workspace
            </Link>
          </div>
        </div>

        <ReviewSection
          scope="platform"
          targetId="platform"
          targetLabel="FlowFi Platform"
          heading="More customer feedback"
          intro="Read published customer-submitted reviews and add your own FlowFi experience."
          emptyTitle="No customer-submitted reviews yet"
          emptyDescription="The curated testimonials above are live already. Be the first customer to add a public review here."
          submitTitle="Write a FlowFi review"
        />
      </section>
    </PublicShell>
  )
}
