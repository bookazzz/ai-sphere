interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenAuth: () => void;
  onOpenPricing: () => void;
  onLogout: () => void;
}

export default function Sidebar({ isOpen, isMobile, isLoggedIn, onToggle, onNewChat, onOpenAuth, onOpenPricing, onLogout }: SidebarProps) {
  // Mobile: always render full sidebar as overlay
  // Desktop: open (300px) or collapsed (56px icon bar)
  const sidebarClass = isMobile
    ? `sidebar sidebar--mobile ${isOpen ? 'sidebar--mobile-open' : ''}`
    : `sidebar ${isOpen ? '' : 'sidebar--collapsed'}`;

  // On mobile, always show full sidebar content (not collapsed icon bar)
  // On desktop, show collapsed when !isOpen
  const showFull = isMobile || isOpen;

  return (
    <aside className={sidebarClass}>
      {showFull ? (
        <>
          {/* Full sidebar */}
          <div className="sidebar__header">
            <button className="sidebar__toggle" onClick={onToggle} aria-label="Закрыть меню">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="1" y="3" width="14" height="10" rx="1" />
                <line x1="4" y1="8" x2="12" y2="8" />
              </svg>
              <span>Закрыть</span>
            </button>
          </div>

          <button className="sidebar__new-chat-btn" onClick={onNewChat}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="1" y="1" width="16" height="16" rx="3" />
              <line x1="9" y1="5" x2="9" y2="13" />
              <line x1="5" y1="9" x2="13" y2="9" />
            </svg>
            Новый чат
          </button>

          <div className="sidebar__search">
            <svg className="sidebar__search-icon-svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" />
              <line x1="11" y1="11" x2="15" y2="15" />
            </svg>
            <input className="sidebar__search-input" type="text" placeholder="Поиск чатов..." />
          </div>

          <div className="sidebar__chats">
            <div className="sidebar__empty">История чатов пуста</div>
          </div>

          <div className="sidebar__footer">
            <button className="sidebar__premium-btn" onClick={onOpenPricing}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" opacity="0.8">
                <path d="M9 1L11.5 6.5L17 7L12.5 11L14 17L9 14L4 17L5.5 11L1 7L6.5 6.5Z" />
              </svg>
              Перейти на «Премиум»
            </button>

            {!isLoggedIn ? (
              <button className="sidebar__login-btn" onClick={onOpenAuth}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 1a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
                  <path d="M3 11a6 6 0 0 1 12 0v1H3v-1z" />
                </svg>
                Войти
              </button>
            ) : (
              <div className="sidebar__user-row">
                <div className="sidebar__user-avatar">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="8" cy="5" r="3" />
                    <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  </svg>
                </div>
                <span className="sidebar__user-name" onClick={onLogout} title="Выйти из аккаунта">Пользователь</span>
                <div className="sidebar__user-actions">
                  <button className="sidebar__user-action" aria-label="Настройки">
                    <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor">
                      <circle cx="2.5" cy="2.5" r="2.5" />
                    </svg>
                  </button>
                  <button className="sidebar__user-action" aria-label="Меню">
                    <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
                      <circle cx="2" cy="2" r="2" />
                      <circle cx="8" cy="2" r="2" />
                      <circle cx="14" cy="2" r="2" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Collapsed icon bar — desktop only */}
          <button className="sidebar__toggle" onClick={onToggle} aria-label="Развернуть меню">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="16" y2="6" />
              <line x1="4" y1="10" x2="16" y2="10" />
              <line x1="4" y1="14" x2="16" y2="14" />
            </svg>
          </button>

          <div className="sidebar__collapsed-icons">
            <button className="sidebar__collapsed-icon" onClick={onNewChat} aria-label="Новый чат" title="Новый чат">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="10" y1="4" x2="10" y2="16" />
                <line x1="4" y1="10" x2="16" y2="10" />
              </svg>
            </button>

            <button className="sidebar__collapsed-icon" aria-label="История чатов" title="История чатов">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="8" />
                <polyline points="10,6 10,10 13,12" />
              </svg>
            </button>

            <button className="sidebar__collapsed-icon" aria-label="Поиск" title="Поиск">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <line x1="12.5" y1="12.5" x2="17" y2="17" />
              </svg>
            </button>
          </div>

          <div className="sidebar__collapsed-bottom">
            <button className="sidebar__collapsed-icon sidebar__collapsed-icon--accent" aria-label="Тарифы" title="Тарифы и баланс" onClick={onOpenPricing}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="10,2 13,8 19,8 14,12 16,19 10,15 4,19 6,12 1,8 7,8" fill="currentColor" fillOpacity="0.15" />
              </svg>
            </button>

            <button className="sidebar__collapsed-icon" aria-label="Профиль" title="Профиль" onClick={onOpenAuth}>
              <div className="sidebar__collapsed-avatar">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="8" cy="5" r="3" />
                  <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                </svg>
              </div>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
