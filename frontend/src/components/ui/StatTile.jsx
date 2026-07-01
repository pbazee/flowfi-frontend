const toneClass = {
  primary: 'bg-primary-50 text-primary-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-100 text-gray-600',
}

export default function StatTile({ label, value, sub, icon: Icon, tone = 'primary' }) {
  return (
    <div className="stat-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon ? (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass[tone] || toneClass.primary}`}>
            <Icon size={16} />
          </div>
        ) : null}
      </div>
      <p className="stat-value">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  )
}
