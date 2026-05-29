export function SettingField({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono-label text-[9px] text-on-surface-variant uppercase">{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-background border border-outline-variant text-on-surface font-mono-code text-[11px] px-2 py-1 focus:border-primary focus:outline-none"
      />
    </label>
  )
}
