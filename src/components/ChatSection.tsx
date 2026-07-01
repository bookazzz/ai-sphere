import QuickActions from './QuickActions';
import ChatPlaceholder from './ChatPlaceholder';

interface ChatSectionProps {
  sidebarOpen: boolean;
  isMobile: boolean;
  onSendMessage: (text: string) => void;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
  onUpdateModel: (modelId: string) => void;
}

export default function ChatSection({ sidebarOpen, isMobile, onSendMessage, onOpenAuth, onToggleSidebar, onUpdateModel }: ChatSectionProps) {
  return (
    <main className="chat">
      {isMobile && (
        <div className="chat__mobile-bar">
          <button className="chat__mobile-toggle" onClick={onToggleSidebar} aria-label="Меню">
            <span>☰</span>
            <span className="chat__mobile-logo">AI-Sphere</span>
          </button>
        </div>
      )}

      <div className="chat__welcome">
        <h1 className="chat__title">Чем могу помочь?</h1>
        <p className="chat__subtitle">
          Работаю с документами, создаю изображения. Без VPN и с оплатой в рублях.
        </p>
      </div>

      {/* Chat Input — icons inside textarea */}
      <div className="chat__input-area">
        <div className="chat__input-wrapper">
          <textarea
            className="chat__input"
            placeholder="Загрузите документ или опишите задачу..."
            rows={3}
          />

          <div className="chat__input-actions">
            <div className="chat__input-left">
              <button
                className="chat__input-icon"
                onClick={onOpenAuth}
                aria-label="Прикрепить файл"
              >
                +
              </button>

              <button
                className="chat__input-model"
                onClick={onOpenAuth}
                aria-label="Выбрать модель"
              >
                <span className="chat__model-dot" />
                DeepSeek V4 Flash
                <span className="chat__model-arrow">▼</span>
              </button>
            </div>

            <div className="chat__input-right">
              <button
                className="chat__input-icon"
                onClick={onOpenAuth}
                aria-label="Голосовой ввод"
              >
                <svg className="chat__mic-icon" width="18" height="24" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="1" width="8" height="14" rx="4" />
                  <path d="M3 11a9 9 0 0 0 18 0" />
                  <line x1="12" y1="19" x2="12" y2="27" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>

              <button
                className="chat__input-icon chat__input-icon--submit"
                onClick={onOpenAuth}
                aria-label="Отправить"
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        <div className="chat__cost-hint">
          Примерная стоимость: от 1 до 5 кредитов
        </div>
      </div>

      <QuickActions onSelect={onSendMessage} />
      <ChatPlaceholder onSelect={onSendMessage} />
    </main>
  );
}
