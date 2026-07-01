import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PublicShell from '@/components/public/PublicShell'
import { usePlatformContent } from '@/hooks/usePlatformContent'
import { formatDate } from '@/lib/formatters'

export default function BlogPage() {
  const { data: content } = usePlatformContent()
  const posts = content?.blogPosts || []

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary-600">Blog</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">Field notes, launch guides, and growth ideas</h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-900">
            New articles are managed from the FlowFi workspace, and the latest entries publish here automatically.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link 
              key={post.id} 
              to={`/blog/${post.id}`}
              className="group flex flex-col overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md hover:border-primary-200"
            >
              {post.image ? (
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] w-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400">No cover image</span>
                </div>
              )}
              
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                  <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-700">
                    {post.category || 'FlowFi'}
                  </span>
                  <span>{post.readTime || 'Quick read'}</span>
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-2">
                  {post.title}
                </h2>
                
                <p className="mt-3 text-sm leading-relaxed text-gray-600 line-clamp-3">
                  {post.excerpt}
                </p>
                
                <div className="mt-auto pt-6 flex items-center gap-2 text-sm font-semibold text-primary-600">
                  Read article <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="mt-12 rounded-3xl border border-dashed border-gray-200 py-20 text-center">
            <p className="text-gray-500">No blog posts published yet.</p>
          </div>
        )}

        <div className="mt-20 rounded-[28px] bg-primary-600 px-8 py-12 text-white text-center">
          <h2 className="text-3xl font-bold">Need help putting these ideas into practice?</h2>
          <p className="mt-4 mx-auto max-w-2xl text-primary-100 text-lg">
            FlowFi combines software, payments, hardware, and rollout support so your team can move from planning to launch quickly.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/contact" className="rounded-xl bg-white px-6 py-3.5 font-semibold text-primary-800 shadow-sm transition-colors hover:bg-primary-50">
              Talk to us
            </Link>
            <Link to="/register" className="rounded-xl border border-white/40 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-white/10">
              Start a workspace
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
