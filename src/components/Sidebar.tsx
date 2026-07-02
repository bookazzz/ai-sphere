import { useState, useRef, useEffect } from 'react';

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  isLoggedIn: boolean;
  userName?: string;
  userCredits?: number;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenAuth: () => void;
  onOpenPricing: () => void;
  onLogout: () => void;
}

export default function Sidebar({ isOpen, isMobile, isLoggedIn, userName, userCredits, onToggle, onNewChat, onOpenAuth, onOpenPricing, onLogout }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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
              <div className="sidebar__user-row" ref={rowRef} onClick={() => setUserMenuOpen(prev => !prev)}>
                <div className="sidebar__user-avatar">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="8" cy="5" r="3" />
                    <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                  </svg>
                </div>
                <div className="sidebar__user-info">
                  <span className="sidebar__user-name">{userName || 'Пользователь'}</span>
                  {userCredits !== undefined && (
                    <span className="sidebar__user-credits">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="6" r="4.5" />
                        <path d="M6 3.5v5" />
                        <path d="M3.5 6h5" />
                      </svg>
                      {userCredits.toLocaleString('ru-RU')} кредитов
                    </span>
                  )}
                </div>
                {userMenuOpen && (
                  <div className="sidebar__user-menu" ref={menuRef}>
                    <button className="sidebar__user-menu-item" onClick={(e) => { e.stopPropagation(); onOpenPricing(); setUserMenuOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="7,1 9,5 13,5 10,8 11,13 7,10 3,13 4,8 1,5 5,5" />
                      </svg>
                      Купить кредиты
                    </button>
                    <button className="sidebar__user-menu-item" onClick={(e) => { e.stopPropagation(); setUserMenuOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="7" cy="7" r="2.5" />
                        <path d="M12 7c0-.3 0-.7-.1-1l1.4-1.1-.9-1.7-1.6.5c-.4-.3-.8-.6-1.3-.8L9.5 1.1H7.9L7.2 2.6c-.5-.1-1-.1-1.5 0L5 1.1H3.4l-.6 1.7c-.5.2-.9.5-1.3.8l-1.6-.5-.9 1.7L1.1 6c-.1.3-.1.7-.1 1s0 .7.1 1l-1.4 1.1.9 1.7 1.6-.5c.4.3.8.6 1.3.8l.6 1.9h1.6l.7-1.5c.5.1 1 .1 1.5 0l.7 1.5h1.6l.6-1.9c.5-.2.9-.5 1.3-.8l1.6.5.9-1.7-1.4-1.1c.1-.3.1-.7.1-1z" />
                      </svg>
                      Настройки
                    </button>
                    <div className="sidebar__user-menu-divider" />
                    <button className="sidebar__user-menu-item sidebar__user-menu-item--danger" onClick={(e) => { e.stopPropagation(); onLogout(); setUserMenuOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h3" />
                        <polyline points="9,10 13,7 9,4" />
                        <line x1="13" y1="7" x2="5" y2="7" />
                      </svg>
                      Выйти из аккаунта
                    </button>
                  </div>
                )}
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
