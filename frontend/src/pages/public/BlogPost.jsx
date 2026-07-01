import { useParams, Navigate, Link } from 'react-router-dom'
import { ArrowLeft, Share2 } from 'lucide-react'
import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import { formatDate } from '@/lib/formatters'

export default function BlogPost() {
  const { id } = useParams()
  const { data: content, isLoading } = usePlatformContent()
  
  if (isLoading) {
    return (
      <PublicShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      </PublicShell>
    )
  }

  const posts = content?.blogPosts || []
  const post = posts.find(p => p.id === id)

  if (!post) {
    return <Navigate to="/blog" replace />
  }

  return (
    <PublicShell>
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Back to Blog
          </Link>
          
          <button 
            type="button" 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: post.title,
                  url: window.location.href,
                })
              } else {
                navigator.clipboard.writeText(window.location.href)
                alert('Link copied to clipboard')
              }
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary-600 transition-colors"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
        
        <header className="mb-10 text-center md:mb-14">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
            <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">
              {post.category || 'FlowFi'}
            </span>
            <span>{post.readTime || 'Quick read'}</span>
            <span>{formatDate(post.publishedAt)}</span>
          </div>
          
          <h1 className="font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl mb-6">
            {post.title}
          </h1>
          
          {post.excerpt && (
            <p className="mx-auto max-w-2xl text-xl text-gray-500 leading-relaxed">
              {post.excerpt}
            </p>
          )}
        </header>

        {post.image && (
          <div className="mb-12 overflow-hidden rounded-3xl md:mb-16 shadow-sm border border-gray-100">
            <img
              src={post.image}
              alt={post.title}
              className="aspect-video w-full object-cover"
            />
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <div 
            className="prose prose-lg prose-primary max-w-none prose-headings:font-display prose-img:rounded-2xl"
            dangerouslySetInnerHTML={{ __html: post.content || '' }}
          />
        </div>
        
        <div className="mx-auto max-w-3xl mt-16 border-t border-gray-100 pt-10">
          <div className="rounded-[28px] bg-gray-50 p-8 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Ready to transform your network?</h3>
              <p className="mt-2 text-gray-600">Start your free trial today and get access to all FlowFi features.</p>
            </div>
            <div className="mt-6 sm:mt-0 sm:shrink-0">
              <Link to="/register" className="btn-primary inline-block">
                Start a workspace
              </Link>
            </div>
          </div>
        </div>
      </article>
    </PublicShell>
  )
}
