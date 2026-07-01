export default function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-primary-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold font-display text-gray-900">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-gray-900">{description}</p>}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}
