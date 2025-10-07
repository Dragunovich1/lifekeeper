interface TopBarProps {
  onToggleSidebar?: () => void
  onLock: () => void
  userName?: string
  avatarSrc?: string
}

const getInitials = (value?: string) => {
  if (!value) {
    return 'LK'
  }
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('')
}

export const TopBar = ({ onToggleSidebar, onLock, userName, avatarSrc }: TopBarProps) => {
  const initials = getInitials(userName)

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-toggle" onClick={onToggleSidebar}>
          Menu
        </button>
        <h2 className="topbar-title">LifeKeeper</h2>
      </div>
      <div className="topbar-right">
          {userName ? (
            <div className="topbar-user-block">
              {avatarSrc ? (
                <img className="topbar-avatar" src={avatarSrc} alt={`Avatar de ${userName}`} />
              ) : (
                <span className="topbar-avatar placeholder" aria-hidden>
                  {initials}
                </span>
              )}
              <span className="topbar-user">{userName}</span>
            </div>
          ) : null}
          <button type="button" className="topbar-lock" onClick={onLock}>
            LogOut
          </button>
        </div>
      </div>
    </header>
  )
}

