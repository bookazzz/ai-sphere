import { useState, useRef, useEffect } from 'react';

interface ChatSession {
  id: string;
  title: string;
  messages: { role: string; content: string }[];
  createdAt: number;
  updatedAt: number;
}

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  isLoggedIn: boolean;
  userName?: string;
  userCredits?: number;
  sessions: ChatSession[];
  currentSessionId?: string | null;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onOpenAuth: () => void;
  onOpenPricing: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  isOpen, isMobile, isLoggedIn, userName, userCredits,
  sessions, currentSessionId,
  onToggle, onNewChat, onSelectSession,
  onOpenAuth, onOpenPricing, onLogout
}: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const sidebarClass = isMobile
    ? `sidebar sidebar--mobile ${isOpen ? 'sidebar--mobile-open' : ''}`
    : `sidebar ${isOpen ? '' : 'sidebar--collapsed'}`;

  const showFull = isMobile || isOpen;

  const filteredSessions = searchQuery
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <aside className={sidebarClass}>
      {showFull ? (
        <>
          {/* Full sidebar */}
          <div className="sidebar__header">
            <button className="sidebar__toggle" onClick={onToggle} aria-label="Закрыть меню">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="1" y="3" width="14" height="10" rx="1" />
                <line x1="5" y1="3" x2="5" y2="13" />
              </svg>
            </button>
            <span className="sidebar__logo">AI-Sphere</span>
          </div>

          <button className="sidebar__new-chat-btn" onClick={onNewChat}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="1" y="1" width="16" height="16" rx="3" />
              <line x1="9" y1="5" x2="9" y2="13" />
              <line x1="5" y1="9" x2="13" y2="9" />
            </svg>
            Новый чат
          </button>

          {sessions.length > 0 && (
            <div className="sidebar__search">
              <svg className="sidebar__search-icon-svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="11" y1="11" x2="15" y2="15" />
              </svg>
              <input
                className="sidebar__search-input"
                type="text"
                placeholder="Поиск чатов..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <div className="sidebar__chats">
            {filteredSessions.length === 0 ? (
              <div className="sidebar__empty">
                {searchQuery ? 'Ничего не найдено' : 'История чатов пуста'}
              </div>
            ) : (
              <div className="sidebar__chat-list">
                {filteredSessions.map(session => (
                  <button
                    key={session.id}
                    className={`sidebar__chat-item ${session.id === currentSessionId ? 'sidebar__chat-item--active' : ''}`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <span className="sidebar__chat-item-title">{session.title}</span>
                    <span className="sidebar__chat-item-date">{formatDate(session.updatedAt)}</span>
                  </button>
                ))}
              </div>
            )}
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
                        <circle cx="7" cy="7" r="6" />
                        <path d="M7 4v3" />
                        <path d="M7 10v.01" />
                      </svg>
                      Тарифы
                    </button>
                    <button className="sidebar__user-menu-item" onClick={(e) => { e.stopPropagation(); onLogout(); setUserMenuOpen(false); }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h3" />
                        <path d="M9 10l4-4-4-4" />
                        <path d="M13 6H5" />
                      </svg>
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Collapsed sidebar: icon bar */
        <div className="sidebar__collapsed">
          <button className="sidebar__collapsed-icon" onClick={onToggle} aria-label="Открыть меню" title="Меню">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <button className="sidebar__collapsed-icon" onClick={onNewChat} aria-label="Новый чат" title="Новый чат">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
          {!isLoggedIn && (
            <button className="sidebar__collapsed-icon sidebar__collapsed-icon--bottom" onClick={onOpenAuth} aria-label="Войти" title="Войти">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
