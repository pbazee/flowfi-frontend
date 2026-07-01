export default function SectionCard({
  title,
  description,
  action,
  className = '',
  bodyClassName = 'p-6',
  children,
}) {
  return (
    <section className={`card overflow-hidden ${className}`.trim()}>
      {(title || description || action) && (
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold text-gray-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-gray-900">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
