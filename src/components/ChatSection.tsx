import { useState, useRef, useEffect } from 'react';
import QuickActions from './QuickActions';
import ChatPlaceholder from './ChatPlaceholder';
import { uploadFile } from '@/lib/api';

interface ChatSectionProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  isLoggedIn: boolean;
  onSendMessage: (text: string, files?: FileItem[]) => void;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
  onUpdateModel: (modelId: string) => void;
  messages: { role: string; content: string }[];
  sending?: boolean;
  chatActive?: boolean;
  onDeleteChat?: () => void;
  onShareChat?: () => void;
}

const MODELS = [
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V4 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
  { id: 'qwen/qwen3-235b-a22b', name: 'Qwen 3 235B' },
];

interface FileItem {
  id: string;
  name: string;
  size: number;
  url: string;
  uploading?: boolean;
  error?: string;
}

export default function ChatSection({ isMobile, sidebarOpen, isLoggedIn, onSendMessage, onOpenAuth, onToggleSidebar, onUpdateModel, messages = [], sending = false, chatActive = false, onDeleteChat, onShareChat }: ChatSectionProps) {
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const modelSelectRef = useRef<HTMLDivElement>(null);
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const handleAttachClick = () => {
    if (!isLoggedIn) {
      onOpenAuth();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setUploading(true);
    const newFiles: FileItem[] = [];

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const tempId = `temp-${Date.now()}-${i}`;
      newFiles.push({ id: tempId, name: file.name, size: file.size, url: '', uploading: true });

      try {
        const result = await uploadFile(file);
        // Update the last pushed item with real data
        const idx = newFiles.length - 1;
        newFiles[idx] = { ...result, uploading: false };
      } catch (err: any) {
        const idx = newFiles.length - 1;
        newFiles[idx] = { ...newFiles[idx], uploading: false, error: err.message };
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setUploading(false);
    // Reset input so re-selecting same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  // Close model select on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target as Node)) {
        setModelSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <main className={`chat ${chatActive || messages.length > 0 ? 'chat--active' : ''}`}>
      {/* Mobile header */}
      {isMobile && (
        <div className="chat__mobile-header">
          <button
            className="chat__mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {/* Sidebar icon: square with vertical divider */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          <span className="chat__mobile-logo">AI-Sphere</span>

          <button className="chat__mobile-menu-btn" aria-label="Меню" onClick={() => setHeaderModalOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>
      )}

      {!chatActive && messages.length === 0 && (
        <div className="chat__welcome">
          <h1 className="chat__title">Чем могу помочь?</h1>
        <p className="chat__subtitle">
          Работаю с документами, создаю изображения. Без VPN и с оплатой в рублях.
        </p>
      </div>
      )}

      {(chatActive || messages.length > 0) && (
        <div className="chat__messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat__message chat__message--${msg.role}`}>
              <div className="chat__message-content">{msg.content}</div>
            </div>
          ))}
          {sending && (
            <div className="chat__message chat__message--assistant">
              <div className="chat__message-content chat__message-content--typing">...</div>
            </div>
          )}
        </div>
      )}

      {/* Chat Input — icons inside textarea */}
      <div className="chat__input-area">
        <div className="chat__input-wrapper">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="chat__file-input"
            onChange={handleFileSelect}
            aria-hidden="true"
          />

          {/* Attached files list */}
          {files.length > 0 && (
            <div className="chat__file-list">
              {files.map(file => (
                <div
                  key={file.id}
                  className={`chat__file-chip ${file.uploading ? 'chat__file-chip--uploading' : ''} ${file.error ? 'chat__file-chip--error' : ''}`}
                >
                  <svg className="chat__file-chip-icon" width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 1H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4l-4-4z" />
                    <polyline points="9,1 9,4 12,4" />
                  </svg>
                  <span className="chat__file-chip-name">{file.name}</span>
                  <span className="chat__file-chip-size">
                    {file.uploading ? '…' : file.error ? 'Ошибка' : formatSize(file.size)}
                  </span>
                  <button
                    className="chat__file-chip-remove"
                    onClick={() => removeFile(file.id)}
                    aria-label="Удалить файл"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="chat__input"
            placeholder="Загрузите документ или опишите задачу..."
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />

          <div className="chat__input-actions">
            <div className="chat__input-left">
              <button
                className="chat__input-icon"
                onClick={handleAttachClick}
                aria-label="Прикрепить файл"
                disabled={uploading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              <div ref={modelSelectRef}>
              <button
                className="chat__input-model"
                onClick={() => setModelSelectOpen(prev => !prev)}
                aria-label="Выбрать модель"
              >
                <span className="chat__model-dot" />
                {selectedModel.name}
                <span className="chat__model-arrow">▼</span>
              </button>
              {modelSelectOpen && (
                <div className="chat__model-select">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      className={`chat__model-option ${m.id === selectedModel.id ? 'chat__model-option--active' : ''}`}
                      onClick={() => {
                        setSelectedModel(m);
                        onUpdateModel(m.id);
                        setModelSelectOpen(false);
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>

            <div className="chat__input-right">
              <button
                className="chat__input-icon"
                onClick={() => isLoggedIn ? alert('Голосовой ввод — скоро') : onOpenAuth()}
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
                onClick={() => {
                  onSendMessage(message, files);
                  setMessage('');
                  setFiles([]);
                }}
                disabled={!message.trim() && files.length === 0}
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

      {!chatActive && messages.length === 0 && (
        <>
          <QuickActions onSelect={onSendMessage} />
          <ChatPlaceholder onSelect={onSendMessage} />
        </>
      )}

      {/* Header modal — three dots menu */}
      {headerModalOpen && (
        <div className="modal-overlay" onClick={() => setHeaderModalOpen(false)}>
          <div className="header-modal" onClick={e => e.stopPropagation()}>
            <div className="header-modal__title">Действия с чатом</div>

            <button
              className="header-modal__btn"
              onClick={() => { onShareChat?.(); setHeaderModalOpen(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Поделиться чатом
            </button>

            <button
              className="header-modal__btn header-modal__btn--danger"
              disabled={!chatActive || messages.length === 0}
              onClick={() => { onDeleteChat?.(); setHeaderModalOpen(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Удалить чат
            </button>

            <button className="header-modal__close" onClick={() => setHeaderModalOpen(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
