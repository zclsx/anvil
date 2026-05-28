import logoUrl from '../assets/logo.svg'

export const LogoIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <img src={logoUrl} className={className} alt="Anvil Logo" />
)
