export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center ${className}`.trim()}>
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
          <Icon size={20} />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-900">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
