import { useState, useRef, useEffect, useMemo } from 'react';

import type { ContentPart } from '@/lib/api';

interface ChatSession {
  id: string;
  title: string;
  messages: { role: string; content: string | ContentPart[] }[];
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
  onDeleteSession?: (id: string) => void;
  onRenameSession?: (id: string, title: string) => void;
}

function getDateLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / 86400000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays <= 7) return 'Последние 7 дней';
  if (diffDays <= 30) return 'Последние 30 дней';
  return 'Ранее';
}

const GROUP_ORDER = ['Сегодня', 'Вчера', 'Последние 7 дней', 'Последние 30 дней', 'Ранее'];

export default function Sidebar({
  isOpen, isMobile, isLoggedIn, userName, userCredits,
  sessions, currentSessionId,
  onToggle, onNewChat, onSelectSession,
  onOpenAuth, onOpenPricing, onLogout,
  onDeleteSession, onRenameSession
}: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // Focus edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const sidebarClass = isMobile
    ? `sidebar sidebar--mobile ${isOpen ? 'sidebar--mobile-open' : ''}`
    : `sidebar ${isOpen ? '' : 'sidebar--collapsed'}`;

  const showFull = isMobile || isOpen;

  const filteredSessions = searchQuery
    ? sessions.filter(s => (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  // Group sessions by date
  const grouped = useMemo(() => {
    const groups: Record<string, ChatSession[]> = {};
    for (const s of filteredSessions) {
      const label = getDateLabel(s.updatedAt);
      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    }
    // Sort sessions within each group by updatedAt desc
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return groups;
  }, [filteredSessions]);

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const commitRename = (id: string) => {
    if (editValue.trim() && editValue !== sessions.find(s => s.id === id)?.title) {
      onRenameSession?.(id, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className={sidebarClass}>
      {showFull ? (
        <>
          {/* Header */}
          <div className="sidebar__header">
            <button className="sidebar__toggle" onClick={onToggle} aria-label="Закрыть меню">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className="sidebar__logo">AI-Sphere</span>
          </div>

          {/* New Chat */}
          <button className="sidebar__new-chat-btn" onClick={onNewChat}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="9" y1="3" x2="9" y2="15" />
              <line x1="3" y1="9" x2="15" y2="9" />
            </svg>
            Новый чат
          </button>

          {/* Search */}
          {sessions.length > 0 && (
            <div className="sidebar__search">
              <svg className="sidebar__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="11" y1="11" x2="15" y2="15" />
              </svg>
              <input
                className="sidebar__search-input"
                type="text"
                placeholder="Поиск"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Chat list with date groups */}
          <div className="sidebar__chats">
            {Object.keys(grouped).length === 0 ? (
              <div className="sidebar__empty">
                {searchQuery ? 'Ничего не найдено' : 'История пуста'}
              </div>
            ) : (
              <div className="sidebar__chat-list">
                {GROUP_ORDER.filter(g => grouped[g]).map(groupLabel => (
                  <div key={groupLabel}>
                    <div className="sidebar__group-label">{groupLabel}</div>
                    {grouped[groupLabel].map(session => (
                      <div
                        key={session.id}
                        className={`sidebar__chat-row ${session.id === currentSessionId ? 'sidebar__chat-row--active' : ''}`}
                        onClick={() => onSelectSession(session.id)}
                        onMouseEnter={() => setHoveredId(session.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {editingId === session.id ? (
                          <input
                            ref={editInputRef}
                            className="sidebar__chat-edit-input"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => commitRename(session.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(session.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <svg className="sidebar__chat-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 8a6 6 0 0 1-7.74 5.67L2 15l1.33-4.26A6 6 0 1 1 14 8z" />
                            </svg>
                            <div className="sidebar__chat-text">
                              <span className="sidebar__chat-title">{session.title || 'Новый чат'}</span>
                            </div>
                            <div
                              className={`sidebar__chat-hover-actions ${(hoveredId === session.id || session.id === currentSessionId || isMobile) ? 'sidebar__chat-hover-actions--visible' : ''}`}
                            >
                              <button
                                className="sidebar__chat-action-btn"
                                onClick={e => { e.stopPropagation(); startRename(session.id, session.title); }}
                                title="Переименовать"
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                  <path d="M10.5 1.5a1.41 1.41 0 0 1 2 2L4 12l-2.5.5L2 10l8.5-8.5z" />
                                </svg>
                              </button>
                              <button
                                className="sidebar__chat-action-btn sidebar__chat-action-btn--danger"
                                onClick={e => { e.stopPropagation(); onDeleteSession?.(session.id); }}
                                title="Удалить"
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                  <path d="M2 3.5h10" />
                                  <path d="M4.5 3.5V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
                                  <path d="M11 3.5v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5" />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sidebar__footer">
            {!isLoggedIn ? (
              <button className="sidebar__login-btn" onClick={onOpenAuth}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
                  <path d="M10 9H2" />
                  <path d="M6 5l-4 4 4 4" />
                </svg>
                Войти
              </button>
            ) : (
              <div className="sidebar__user-row" ref={rowRef} onClick={() => setUserMenuOpen(prev => !prev)}>
                <div className="sidebar__user-avatar">
                  {userName ? userName.charAt(0).toUpperCase() : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="9" cy="6" r="3.5" />
                      <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                    </svg>
                  )}
                </div>
                <div className="sidebar__user-info">
                  <span className="sidebar__user-name">{userName || 'Пользователь'}</span>
                  {userCredits !== undefined && (
                    <span className="sidebar__user-credits">
                      {userCredits.toLocaleString('ru-RU')} кредитов
                    </span>
                  )}
                </div>
                {userMenuOpen && (
                  <div className="sidebar__user-menu" ref={menuRef}>
                    <button className="sidebar__user-menu-item" onClick={(e) => { e.stopPropagation(); onOpenPricing(); setUserMenuOpen(false); }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="8" r="6.5" />
                        <path d="M8 4.5v3" />
                        <path d="M8 11v.01" />
                      </svg>
                      Тарифы
                    </button>
                    <button className="sidebar__user-menu-item sidebar__user-menu-item--danger" onClick={(e) => { e.stopPropagation(); onLogout(); setUserMenuOpen(false); }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 13H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" />
                        <path d="M11 10l3-3-3-3" />
                        <path d="M14 7H6" />
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
        /* Collapsed sidebar */
        <div className="sidebar__collapsed">
          <button className="sidebar__collapsed-icon" onClick={onToggle} aria-label="Открыть меню" title="Меню">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button className="sidebar__collapsed-icon" onClick={onNewChat} aria-label="Новый чат" title="Новый чат">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className="sidebar__collapsed-spacer" />
          {!isLoggedIn && (
            <button className="sidebar__collapsed-icon" onClick={onOpenAuth} aria-label="Войти" title="Войти">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
