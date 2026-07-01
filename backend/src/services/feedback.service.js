const { getSupabaseAdmin } = require('../lib/supabase')

function serializeReview(review) {
  if (!review) return null

  return {
    id: review.id,
    scope: review.scope,
    target_id: review.target_id,
    target_label: review.target_label,
    name: review.reviewer_name,
    email: review.reviewer_email,
    phone: review.reviewer_phone,
    role: review.reviewer_role,
    venue: review.reviewer_company,
    rating: Number(review.rating || 0),
    quote: review.message,
    status: review.status,
    published_at: review.published_at,
    created_at: review.created_at,
    updated_at: review.updated_at,
  }
}

function serializeContactMessage(message) {
  if (!message) return null

  return {
    id: message.id,
    name: message.name,
    email: message.email,
    phone: message.phone,
    message: message.message,
    status: message.status,
    created_at: message.created_at,
    updated_at: message.updated_at,
  }
}

async function syncProductReviewStats(productId) {
  if (!productId) return

  const db = getSupabaseAdmin()
  const { data: reviews, error } = await db
    .from('review_submissions')
    .select('rating')
    .eq('scope', 'product')
    .eq('target_id', productId)
    .eq('status', 'published')

  if (error) throw error

  const reviewCount = reviews?.length || 0
  const averageRating = reviewCount
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount
    : 0

  const { error: updateError } = await db
    .from('shop_products')
    .update({
      rating: reviewCount ? Number(averageRating.toFixed(2)) : 0,
      review_count: reviewCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (updateError) throw updateError
}

module.exports = {
  serializeContactMessage,
  serializeReview,
  syncProductReviewStats,
}
