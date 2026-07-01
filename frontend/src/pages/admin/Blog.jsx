import { BookOpen, Plus, Save, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatTile from '@/components/ui/StatTile'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useAdminContentSettings } from '@/hooks/useAdminContentSettings'
import { filesToDataUrls } from '@/lib/fileUploads'
import { formatNumber } from '@/lib/formatters'

export default function Blog() {
  const {
    form,
    isLoading,
    saveMutation,
    updateBlogPost,
    addBlogPost,
    removeBlogPost,
    saveSettings,
  } = useAdminContentSettings()

  async function handleCoverUpload(postId, event) {
    try {
      const urls = await filesToDataUrls(event.target.files, { maxSizeBytes: 3 * 1024 * 1024 })
      if (urls[0]) {
        updateBlogPost(postId, 'image', urls[0])
        toast.success('Cover image added')
      }
    } catch (error) {
      toast.error(error.message || 'Could not upload image')
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Public Content"
        title="Blog posts"
        description="Manage the public blog cards and the full article copy in a dedicated publishing screen."
        actions={(
          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : 'Save blog'}
          </button>
        )}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatTile label="Published posts" value={formatNumber(form.blogPosts.length)} icon={BookOpen} />
        <StatTile label="Publishing flow" value="Separated" icon={BookOpen} tone="green" />
        <StatTile label="Landing feed" value="Synced" icon={BookOpen} tone="blue" />
      </div>

      <SectionCard
        title="Articles"
        description="Each entry controls the public blog listing card plus the full article body."
        action={(
          <button type="button" onClick={addBlogPost} className="btn-outline flex items-center gap-2">
            <Plus size={14} />
            Add post
          </button>
        )}
      >
        <div className="space-y-5">
          {form.blogPosts.map((post, index) => (
            <div key={post.id} className="rounded-3xl border border-gray-100 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Post #{index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{post.title || 'Untitled post'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => removeBlogPost(post.id)}
                  className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Title</label>
                  <input
                    value={post.title}
                    onChange={(event) => updateBlogPost(post.id, 'title', event.target.value)}
                    className="input"
                    placeholder="The MikroTik rollout checklist we use before go-live"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input
                    value={post.category}
                    onChange={(event) => updateBlogPost(post.id, 'category', event.target.value)}
                    className="input"
                    placeholder="Operations"
                  />
                </div>
                <div>
                  <label className="label">Read time</label>
                  <input
                    value={post.readTime}
                    onChange={(event) => updateBlogPost(post.id, 'readTime', event.target.value)}
                    className="input"
                    placeholder="5 min read"
                  />
                </div>
                <div>
                  <label className="label">Published date</label>
                  <input
                    type="date"
                    value={post.publishedAt}
                    onChange={(event) => updateBlogPost(post.id, 'publishedAt', event.target.value)}
                    className="input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Cover image URL</label>
                  <input
                    value={post.image}
                    onChange={(event) => updateBlogPost(post.id, 'image', event.target.value)}
                    className="input"
                    placeholder="https://images.unsplash.com/..."
                  />
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100">
                    <Upload size={14} />
                    Upload from device
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleCoverUpload(post.id, event)}
                    />
                  </label>
                  {post.image ? (
                    <img
                      src={post.image}
                      alt={post.title || 'Blog cover'}
                      className="mt-4 h-40 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <label className="label">Excerpt</label>
                <textarea
                  value={post.excerpt}
                  onChange={(event) => updateBlogPost(post.id, 'excerpt', event.target.value)}
                  className="input min-h-24"
                  placeholder="A short summary shown on cards and previews."
                />
              </div>

              <div className="mt-4">
                <label className="label">Article content</label>
                <div className="mt-2">
                  <RichTextEditor
                    value={post.content || ''}
                    onChange={(html) => updateBlogPost(post.id, 'content', html)}
                    placeholder="Write the full article body here..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
