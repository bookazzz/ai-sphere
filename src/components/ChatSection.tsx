import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QuickActions from './QuickActions';
import ChatPlaceholder from './ChatPlaceholder';
import { apiCall, checkFacts, uploadFile, punctuateText, ensembleChat, sendFeedback, prepareRegenerateMessages, type FactCheckResult, type ContentPart, type ChatMessage } from '@/lib/api';
import { categories, allModels, DEFAULT_MODEL_ID, getCategoryByModelId, isVisionCapable, filterVisionModels, loadModelsFromApi, subscribeToModelsUpdates } from '@/lib/models-data';

// Read a File as a base64 data URL
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Image wrapper with download overlay on hover
function DownloadableImage({ src: imageUrl, alt, className, style }: { src: string; alt?: string; className?: string; style?: React.CSSProperties }) {
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `image.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(imageUrl, '_blank');
    }
  }, [imageUrl]);

  return (
    <div className="chat__image-wrapper">
      <img src={imageUrl} alt={alt || 'image'} className={className} style={style} />
      <button className="chat__image-download-btn" onClick={handleDownload} title="Скачать">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
  );
}

// Extract plain text from a message content (string or content array)
function getMessageText(content: string | { type: string; [key: string]: any }[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(p => p.type === 'text');
    return textPart?.text || '[изображение]';
  }
  return '';
}

// Renders message content: text + images for content arrays
// For assistant messages, text is rendered as Markdown
function RenderContent({ content, role }: { content: string | { type: string; [key: string]: any }[]; role?: string }) {
  const textContent = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map(p => (p.type === 'text' ? p.text : null)).filter(Boolean).join('')
      : String(content);

  const images: string[] = Array.isArray(content)
    ? content.filter(p => p.type === 'image_url' && p.image_url?.url).map(p => p.image_url.url)
    : [];

  // [LOG] Track image content
  if (typeof content === 'string' && content.includes('![generated]')) {
    console.debug('[RenderContent] content includes ![generated]:', content.slice(0, 200));
  }

  // Parse ![generated](url) from markdown text — extract as real image URLs
  const generatedImages: string[] = [];
  let cleanContent = textContent;
  if (typeof textContent === 'string') {
    const genRegex = /!\[generated\]\(([^)]+)\)/g;
    let match;
    while ((match = genRegex.exec(textContent)) !== null) {
      generatedImages.push(match[1]);
      console.debug('[RenderContent] extracted generated image URL:', match[1].slice(0, 100));
    }
    // Remove ![generated] markers so ReactMarkdown doesn't try to render them again
    cleanContent = textContent.replace(genRegex, '').trim();
  }

  if (role === 'assistant') {
    return (
      <div className="chat__message-content chat__message-content--assistant">
        {cleanContent ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre({ children }) {
                return <pre className="chat__code-block">{children}</pre>;
              },
              code({ className, children, ...props }) {
                const isInline = !className;
                if (isInline) {
                  return <code className="chat__inline-code">{children}</code>;
                }
                return (
                  <pre className="chat__code-block">
                    <code className={className} {...props}>{children}</code>
                  </pre>
                );
              },
              img({ src, alt }) {
                console.debug('[RenderContent] ReactMarkdown rendering img:', src ? src.slice(0, 80) : 'no src');
                return <DownloadableImage src={String(src || '')} alt={alt || ''} className="chat__message-image" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, marginTop: 4, objectFit: 'contain' }} />;
              },
              a({ href, children }) {
                return <a href={href} target="_blank" rel="noopener noreferrer" className="chat__link">{children}</a>;
              },
              table({ children }) {
                return (
                  <div className="chat__table-wrapper">
                    <table className="chat__table">{children}</table>
                  </div>
                );
              },
              th({ children }) {
                return <th className="chat__th">{children}</th>;
              },
              td({ children }) {
                return <td className="chat__td">{children}</td>;
              },
            }}
          >
            {cleanContent}
          </ReactMarkdown>
        ) : null}
        {/* Render extracted ![generated] images directly (fallback) */}
        {generatedImages.map((url, i) => (
          <DownloadableImage key={`gen-${i}`} src={String(url)} alt="generated image" className="chat__message-image" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, marginTop: 4, objectFit: 'contain' }} />
        ))}
        {images.map((url, i) => (
          <DownloadableImage key={i} src={String(url)} alt="attached image" className="chat__message-image" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, marginTop: 8, objectFit: 'contain' }} />
        ))}
      </div>
    );
  }

  // User message — plain text
  if (typeof content === 'string') {
    return <div className="chat__message-content chat__message-content--user">{content}</div>;
  }
  if (Array.isArray(content)) {
    return (
      <div className="chat__message-content chat__message-content--user">
        {content.map((part, i) => {
          if (part.type === 'text') return <span key={i}>{part.text}</span>;
          if (part.type === 'image_url' && part.image_url?.url) {
            return (
              <DownloadableImage
                key={i}
                src={String(part.image_url?.url || '')}
                alt="attached image"
                className="chat__message-image"
                style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, marginTop: 4, objectFit: 'contain' }}
              />
            );
            }
          return null;
        })}
      </div>
    );
  }
  return <div className="chat__message-content chat__message-content--user">{String(content)}</div>;
}

interface ChatSectionProps {
  isMobile: boolean;
  sidebarOpen: boolean;
  isLoggedIn: boolean;
  onSendMessage: (text: string, files?: FileItem[]) => void;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
  onUpdateModel: (modelId: string) => void;
  messages: { role: string; content: string | { type: string; [key: string]: any }[] }[];
  sending?: boolean;
  thinkingText?: string;
  chatActive?: boolean;
  onDeleteChat?: () => void;
  onShareChat?: () => void;
  onEnsembleResult?: (text: string, files: FileItem[] | undefined, result: any) => void;
  onActivateChat?: () => void;
  onRegenerate?: () => void;
  currentSessionId?: string | null;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  url: string;
  dataUrl?: string;
  uploading?: boolean;
  error?: string;
}

export default function ChatSection({ isMobile, sidebarOpen, isLoggedIn, onSendMessage, onOpenAuth, onToggleSidebar, onUpdateModel, messages = [], sending = false, thinkingText = '', chatActive = false, onDeleteChat, onShareChat, onEnsembleResult, onActivateChat, onRegenerate, currentSessionId }: ChatSectionProps) {
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    allModels.find(m => m.id === DEFAULT_MODEL_ID) || allModels[0]
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [likedMessages, setLikedMessages] = useState<Set<number>>(new Set());
  const [dislikedMessages, setDislikedMessages] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const onSendRef = useRef(onSendMessage);
  onSendRef.current = onSendMessage;
  const modelSelectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const [visionAlert, setVisionAlert] = useState<{ modelName: string; visionModels: typeof allModels } | null>(null);
  const [factCheckResults, setFactCheckResults] = useState<Record<number, FactCheckResult>>({});
  const [factCheckLoading, setFactCheckLoading] = useState<number | null>(null);
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  const [ensembleError, setEnsembleError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [, forceUpdate] = useState(0);

  // Load models from API on mount (async update)
  useEffect(() => {
    loadModelsFromApi().then(() => {
      setModelsReady(true);
      // Sync selectedModel if current model exists in updated list
      if (selectedModel) {
        const updated = allModels.find(m => m.id === selectedModel.id);
        if (updated) setSelectedModel(updated);
      }
    });
  }, []);

  // Auto-poll models every 60s and react to admin price changes
  useEffect(() => {
    const unsub = subscribeToModelsUpdates(() => {
      // Force re-render so allModels/categories prices refresh
      forceUpdate(n => n + 1);
    });
    const interval = setInterval(() => {
      loadModelsFromApi();
    }, 30000);
    return () => { clearInterval(interval); unsub(); };
  }, []);

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

    // Check for image files when model doesn't support vision
    const isImageFile = (f: File) => f.type.startsWith('image/');
    const hasImages = Array.from(selected).some(isImageFile);
    if (hasImages && !isVisionCapable(selectedModel.id)) {
      const visionModels = filterVisionModels();
      setVisionAlert({
        modelName: selectedModel.name,
        visionModels: visionModels.slice(0, 5),
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const newFiles: FileItem[] = [];

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const tempId = `temp-${Date.now()}-${i}`;
      newFiles.push({ id: tempId, name: file.name, size: file.size, url: '', uploading: true });

      try {
        const dataUrl = await readFileAsDataURL(file);
        const result = await uploadFile(file);
        const idx = newFiles.length - 1;
        newFiles[idx] = { ...result, uploading: false, dataUrl };
      } catch (err: any) {
        const idx = newFiles.length - 1;
        newFiles[idx] = { ...newFiles[idx], uploading: false, error: err.message };
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setUploading(false);
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

  // Focus search when dropdown opens
  useEffect(() => {
    if (modelSelectOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [modelSelectOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter categories by search query
  const filteredCategories = modelSearch.trim()
    ? categories
        .map(cat => ({
          ...cat,
          models: cat.models.filter(m =>
            m.name.toLowerCase().includes(modelSearch.toLowerCase())
          ),
        }))
        .filter(cat => cat.models.length > 0)
    : categories;

  const handleSelectModel = (model: typeof allModels[0]) => {
    setSelectedModel(model);
    onUpdateModel(model.id);
    setModelSelectOpen(false);
    setModelSearch('');
  };

  // ──────────────── Voice Input ────────────────

  const startVoiceInput = useCallback(() => {
    if (!isLoggedIn) {
      onOpenAuth();
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert('Голосовой ввод не поддерживается в этом браузере. Используйте Chrome или Edge.');
      return;
    }

    if (isRecording) {
      // Stop recording — clear ref so onend doesn't auto-restart
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    // continuous=false + manual restart in onend avoids Chrome duplicate-result bug
    recognition.continuous = false;

    // Accumulated final transcript — persists across manual restarts
    let accumulatedFinal = '';
    // Client-side silence detection: stop if no new results for 2 seconds
    // (Chrome's SpeechRecognition may not fire onend reliably on its own)
    let silenceTimer: any = null;
    const SILENCE_MS = 2200;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      // Use resultIndex: only process NEW/changed results (MDN standard)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          accumulatedFinal += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setMessage((accumulatedFinal + interimTranscript).trimStart());
      // Reset silence timer on every new speech result
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (recognitionRef.current === recognition) {
          recognition.stop();
        }
      }, SILENCE_MS);
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.');
      } else if (event.error === 'no-speech') {
        // Silent — user just didn't speak
      } else {
        alert(`Ошибка распознавания: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      // Clear silence timer (if recognition stopped by something else)
      if (silenceTimer) clearTimeout(silenceTimer);
      // continuous=false means recognition stops after silence automatically.
      // Distinguish natural end from user-initiated stop via recognitionRef.
      const isNaturalEnd = (recognitionRef.current === recognition);
      const rawText = accumulatedFinal.trim();

      if (isNaturalEnd) {
        recognitionRef.current = null;
      }
      setIsRecording(false);

      if (rawText && isNaturalEnd) {
        // Natural silence — punctuate the transcript and auto-send
        punctuateText(rawText).then(result => {
          setMessage(result);
          // Small delay so the punctuated text is briefly visible, then auto-send
          setTimeout(() => {
            onSendRef.current(result, []);
            setMessage('');
          }, 300);
        }).catch(() => {
          // On error, send raw text
          onSendRef.current(rawText, []);
          setMessage('');
        });
      }
      // User-initiated stop: text stays in textarea as-is for review
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isLoggedIn, onOpenAuth, isRecording]);

  // ──────────────── Fact Check ────────────────

  const handleFactCheck = async (idx: number, msg: { role: string; content: string | any[] }) => {
    if (factCheckResults[idx] || factCheckLoading !== null) return;
    setFactCheckLoading(idx);
    try {
      // Find the user prompt that preceded this assistant message
      const userMsg = [...messages.slice(0, idx)].reverse().find(m => m.role === 'user');
      const prompt = userMsg
        ? (typeof userMsg.content === 'string' ? userMsg.content : userMsg.content.map(p => p.text || '').join(' '))
        : '';
      const responseText = typeof msg.content === 'string' ? msg.content : msg.content.map(p => p.text || '').join(' ');

      const result = await checkFacts(selectedModel.id, prompt, responseText);
      setFactCheckResults(prev => ({ ...prev, [idx]: result }));
    } catch (e: any) {
      setFactCheckResults(prev => ({
        ...prev,
        [idx]: { errors: [{ claim: e.message, status: 'incorrect' as const, correction: null }], confidence: 0, verified_claims: [], details: '' }
      }));
    } finally {
      setFactCheckLoading(null);
    }
  };

  const handleEnsemble = useCallback(async () => {
    if (!message.trim() || ensembleLoading || !isLoggedIn) return;
    if (!onEnsembleResult) return;

    setEnsembleLoading(true);
    setEnsembleError(null);

    const text = message;
    const currentFiles = [...files];

    // Activate chat view immediately (show messages area instead of welcome)
    onActivateChat?.();

    setMessage('');
    setFiles([]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let userContent: ContentPart[] | string;
      if (currentFiles.length > 0) {
        const imageParts: ContentPart[] = currentFiles
          .filter((f): f is FileItem & { dataUrl: string } => !!f.dataUrl?.startsWith('data:image/'))
          .map(f => ({ type: 'image_url' as const, image_url: { url: f.dataUrl } }));
        userContent = [{ type: 'text' as const, text } as ContentPart, ...imageParts];
      } else {
        userContent = text;
      }

      const messagesPayload: ChatMessage[] = [{ role: 'user', content: userContent }];
      const result = await ensembleChat('budget', messagesPayload, controller.signal);
      clearTimeout(timeoutId);
      onEnsembleResult(text, currentFiles, result);
    } catch (e: any) {
      console.error('[Ensemble] Error:', e);
      if (e.name === 'AbortError') {
        setEnsembleError('Таймаут: модели не ответили за 60 секунд. Попробуйте ещё раз.');
      } else {
        setEnsembleError(e.message || 'Ошибка при запросе Ensemble');
      }
    } finally {
      setEnsembleLoading(false);
    }
  }, [message, files, ensembleLoading, isLoggedIn, onEnsembleResult, onActivateChat]);

  return (
    <main className={`chat ${chatActive || (isLoggedIn && messages.length > 0) ? 'chat--active' : ''}`}>
      {/* Mobile header — always rendered, visibility via CSS */}
      <div className="chat__mobile-header">
        <button
          className="chat__mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
        >
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

      {!chatActive && messages.length === 0 ? (
        <div className="chat__welcome">
          <h1 className="chat__title">AI-Sphere — нейросети в одном чате без VPN</h1>
          <p className="chat__subtitle">
            ChatGPT, Claude, Gemini, DeepSeek и другие модели. Работа с документами, изображениями и кодом. Без VPN, с оплатой в рублях.
          </p>
        </div>
      ) : (
        <div className="chat__messages" ref={messagesContainerRef}>
          {messages.map((msg, i) => {
            const prevMsg = i > 0 ? messages[i - 1] : null;
            return msg.role === 'user' ? (
   <div key={i} className="chat__message chat__message--user">
     <RenderContent content={msg.content} role="user" />
     <div className="chat__message-actions chat__message-actions--user">
       <button
         className={`chat__action-btn${copiedIndex === i ? ' chat__action-btn--active' : ''}`}
         onClick={() => {
           navigator.clipboard.writeText(getMessageText(msg.content));
           setCopiedIndex(i);
           setTimeout(() => setCopiedIndex(null), 2000);
         }}
         aria-label="Копировать"
         title="Копировать"
       >
         {copiedIndex === i ? (
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
             <polyline points="20 6 9 17 4 12" />
           </svg>
         ) : (
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
           </svg>
         )}
       </button>
     </div>
   </div>
 ) : (
              <div key={i} className="chat__message chat__message--assistant">
                <div className="chat__message-header">
                  <span className="chat__message-model-name">{selectedModel.name}</span>
                </div>
                <RenderContent content={msg.content} role="assistant" />
                <div className="chat__message-actions">
                  <button
                    className={`chat__action-btn${copiedIndex === i ? ' chat__action-btn--active' : ''}`}
                    onClick={() => {
                      navigator.clipboard.writeText(getMessageText(msg.content));
                      setCopiedIndex(i);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    aria-label="Копировать"
                    title="Копировать"
                  >
                    {copiedIndex === i ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                  <button
                    className={`chat__action-btn${likedMessages.has(i) ? ' chat__action-btn--active chat__action-btn--liked' : ''}`}
                    onClick={() => {
                      const next = new Set(likedMessages);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      setLikedMessages(next);
                      setDislikedMessages(prev => { const d = new Set(prev); d.delete(i); return d; });
                      if (currentSessionId) {
                        sendFeedback({
                          session_id: currentSessionId,
                          message_index: i,
                          feedback_type: 'like',
                          model: selectedModel.id,
                        }).catch(() => {});
                      }
                    }}
                    aria-label="Нравится"
                    title="Нравится"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                  </button>
                  <button
                    className={`chat__action-btn${dislikedMessages.has(i) ? ' chat__action-btn--active chat__action-btn--disliked' : ''}`}
                    onClick={() => {
                      const next = new Set(dislikedMessages);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      setDislikedMessages(next);
                      setLikedMessages(prev => { const l = new Set(prev); l.delete(i); return l; });
                      if (currentSessionId) {
                        sendFeedback({
                          session_id: currentSessionId,
                          message_index: i,
                          feedback_type: 'dislike',
                          model: selectedModel.id,
                        }).catch(() => {});
                      }
                    }}
                    aria-label="Не нравится"
                    title="Не нравится"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                    </svg>
                  </button>
                  <button
                    className="chat__action-btn"
                    onClick={() => onRegenerate?.()}
                    disabled={sending}
                    aria-label="Перегенерировать"
                    title="Перегенерировать"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                  </button>
                  <div className="chat__message-actions-spacer" />
                  <div className="chat__factcheck-wrap">
                  {factCheckResults[i] ? (
                    <div className="chat__factcheck-result">
                      <div className="chat__factcheck-header">
                        <span className="chat__factcheck-icon">🔍</span>
                        <span className="chat__factcheck-label">Факт-чек</span>
                        <span className={`chat__factcheck-score ${factCheckResults[i].confidence >= 80 ? 'chat__factcheck-score--high' : factCheckResults[i].confidence >= 50 ? 'chat__factcheck-score--mid' : 'chat__factcheck-score--low'}`}>
                          {factCheckResults[i].confidence}%
                        </span>
                      </div>
                      {factCheckResults[i].errors.length > 0 && (
                        <div className="chat__factcheck-errors">
                          {factCheckResults[i].errors.map((e, ei) => (
                            <div key={ei} className="chat__factcheck-claim chat__factcheck-claim--error">
                              <div className="chat__factcheck-claim-text">✗ {e.claim}</div>
                              {e.correction && <div className="chat__factcheck-correction">→ {e.correction}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {factCheckResults[i].verified_claims.filter(c => c.status === 'correct').length > 0 && (
                        <div className="chat__factcheck-verified">
                          {factCheckResults[i].verified_claims.filter(c => c.status === 'correct').map((c, ci) => (
                            <div key={ci} className="chat__factcheck-claim chat__factcheck-claim--ok">
                              <div className="chat__factcheck-claim-text">✓ {c.claim}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {factCheckResults[i].details && (
                        <div className="chat__factcheck-details">{factCheckResults[i].details}</div>
                      )}
                    </div>
                  ) : (
                    <button
                      className="chat__factcheck-btn"
                      onClick={() => handleFactCheck(i, msg)}
                      disabled={factCheckLoading !== null}
                    >
                      {factCheckLoading === i ? (
                        <><span className="chat__factcheck-spinner" /> Проверка...</>
                      ) : (
                        '🔍 Проверить факты'
                      )}
                    </button>
                  )}
                </div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="chat__message chat__message--assistant">
              <div className="chat__message-header">
                <span className="chat__message-model-name">{selectedModel.name}</span>
              </div>
              <div className="chat__message-content chat__message-content--assistant">
                {thinkingText ? (
                  <div className="chat__thinking">
                    <div className="chat__thinking-dots">
                      <span className="chat__typing-dot" />
                      <span className="chat__typing-dot" />
                      <span className="chat__typing-dot" />
                    </div>
                    <div className="chat__thinking-text">{thinkingText}</div>
                  </div>
                ) : (
                  <div className="chat__typing-indicator">
                    <span className="chat__typing-dot" />
                    <span className="chat__typing-dot" />
                    <span className="chat__typing-dot" />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Chat Input */}
      <div className="chat__input-area">
        <div className="chat__input-wrapper">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="chat__file-input"
            onChange={handleFileSelect}
            aria-hidden="true"
          />

          <div className={`chat__input-box${files.length > 0 ? ' has-files' : ''}`}>
          {files.length > 0 && (
            <div className="chat__file-list">
              {files.map(file => (
                <div
                  key={file.id}
                  className={`chat__file-chip ${file.uploading ? 'chat__file-chip--uploading' : ''} ${file.error ? 'chat__file-chip--error' : ''}`}
                >
                  {file.dataUrl?.startsWith('data:image/') ? (
                    <img className="chat__file-chip-thumb" src={file.dataUrl} alt="" />
                  ) : (
                    <svg className="chat__file-chip-icon" width="16" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 1H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4l-4-4z" />
                      <polyline points="9,1 9,4 12,4" />
                    </svg>
                  )}
                  <span className="chat__file-chip-name">{file.name}</span>
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
            onFocus={() => setUserStarted(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && (message.trim() || files.length > 0)) {
                e.preventDefault();
                if (isRecording) {
                  recognitionRef.current?.stop();
                  recognitionRef.current = null;
                  setIsRecording(false);
                }
                onSendMessage(message, files);
                setMessage('');
                setFiles([]);
              }
            }}
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
                <div className="chat__model-select chat__model-select--grouped">
                  {/* Search */}
                  <div className="chat__model-search">
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="chat__model-search-input"
                      placeholder="Поиск моделей..."
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                    />
                  </div>

                  {/* Grouped list */}
                  <div className="chat__model-groups">
                    {filteredCategories.map(cat => (
                      <div key={cat.name} className="chat__model-group">
                        <div className="chat__model-group-title">{cat.name}</div>
                        {cat.models.map(m => (
                          <button
                            key={m.id}
                            className={`chat__model-option ${m.id === selectedModel.id ? 'chat__model-option--active' : ''}`}
                            onClick={() => handleSelectModel(m)}
                          >
                            <span className="chat__model-option-name">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {filteredCategories.length === 0 && (
                      <div className="chat__model-empty">Ничего не найдено</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

            <div className="chat__input-right">
              <button
                className={`chat__input-icon${isRecording ? ' chat__input-icon--recording' : ''}`}
                onClick={startVoiceInput}
                aria-label={isRecording ? 'Остановить запись' : 'Голосовой ввод'}
              >
                {isRecording ? (
                  <svg className="chat__mic-icon" width="18" height="24" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="20" rx="3" fill="#ef4444" stroke="#ef4444" />
                    <line x1="11" y1="11" x2="11" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="13" y1="11" x2="13" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="chat__mic-icon" width="18" height="24" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="1" width="8" height="14" rx="4" />
                    <path d="M3 11a9 9 0 0 0 18 0" />
                    <line x1="12" y1="19" x2="12" y2="27" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              <button
                className="chat__input-icon chat__input-icon--submit"
                onClick={() => {
                if (isRecording) {
                  recognitionRef.current?.stop();
                  recognitionRef.current = null;
                  setIsRecording(false);
                }
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
        </div>

        {isLoggedIn && message.trim() && (
        <div className="chat__ensemble-row">
          <button
            className="chat__ensemble-btn"
            onClick={handleEnsemble}
            disabled={ensembleLoading || !message.trim()}
          >
            {ensembleLoading ? (
              <><span className="chat__ensemble-spinner" /> Опрашиваем 3 модели...</>
            ) : (
              '🧠 Уточнить у 3 моделей'
            )}
          </button>
        </div>
        )}

        {ensembleError && (
        <div className="chat__ensemble-error">
          ⚠️ {ensembleError}
          <button className="chat__ensemble-error-close" onClick={() => setEnsembleError(null)}>✕</button>
        </div>
        )}

        <div className="chat__cost-hint">
          Примерная стоимость: от 1 до 5 кредитов
        </div>
      </div>

      {!userStarted && !chatActive && messages.length === 0 && !isLoggedIn && (
        <>
          <QuickActions onSelect={onSendMessage} />
          <ChatPlaceholder onSelect={onSendMessage} />
        </>
      )}

      {/* Header modal */}
      {headerModalOpen && (
        <div className="modal-overlay" onClick={() => setHeaderModalOpen(false)}>
          <div className="header-modal" onClick={e => e.stopPropagation()}>
            <div className="header-modal__title">Действия с чатом</div>

            <button
              className="header-modal__btn"
              onClick={() => { setHeaderModalOpen(false); setShareModalOpen(true); }}
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

      {/* Share modal */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <div className="share-modal__title">Поделиться чатом</div>

            <div className="share-modal__grid">
              <button
                className="share-modal__btn"
                onClick={() => {
                  const url = window.location.href;
                  const text = messages.map(m => `${m.role === 'user' ? 'Я' : 'AI'}: ${getMessageText(m.content)}`).join('\n');
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
                  setShareModalOpen(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#0088cc">
                  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.37.18 1.1 1.3L17.1 18.1c-.2.96-.74 1.2-1.5.75l-4.13-3.04-1.99 1.93c-.18.18-.33.33-.68.33z"/>
                </svg>
                Telegram
              </button>

              <button
                className="share-modal__btn"
                onClick={() => {
                  const url = window.location.href;
                  const text = messages.map(m => `${m.role === 'user' ? 'Я' : 'AI'}: ${getMessageText(m.content)}`).join('\n');
                  window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
                  setShareModalOpen(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>

              <button
                className="share-modal__btn"
                onClick={() => {
                  const url = window.location.href;
                  const title = 'AI-Sphere Chat';
                  const text = messages.map(m => `${m.role === 'user' ? 'Я' : 'AI'}: ${getMessageText(m.content)}`).join('\n');
                  window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(text)}`, '_blank');
                  setShareModalOpen(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#0077FF">
                  <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14c5.6 0 6.93-1.33 6.93-6.93V8.93C22 3.33 20.67 2 15.07 2zm3.57 12.54h-1.27c-.63 0-.83-.5-1.47-1.27-.56-.6-1.05-.79-1.2-.79-.2 0-.27.1-.27.56v1c0 .38-.1.56-.87.56-1.15 0-2.42-.7-3.32-2.01-1.4-1.97-1.78-3.48-1.78-3.79 0-.17.1-.3.3-.3h1.27c.28 0 .38.13.48.43.42 1.22 1.14 2.43 1.43 2.43.1 0 .17-.06.17-.48v-1.3c0-.64-.36-.7-.36-.94 0-.13.13-.24.25-.24h1.6c.25 0 .34.13.34.43v1.7c0 .26.1.35.2.35.12 0 .22-.06.35-.25.5-.58.9-1.51.9-1.51.06-.15.12-.28.34-.28h1.27c.28 0 .36.14.28.36-.36 1.13-1.46 2.3-1.46 2.3-.12.14-.15.22 0 .4.1.13.78.78 1 1.2.22.32.31.55.31.88 0 .15-.04.28-.18.38-.1.07-.3.1-.4.12z"/>
                </svg>
                VK
              </button>

              <button
                className="share-modal__btn share-modal__btn--copy"
                onClick={() => {
                  const url = window.location.href;
                  navigator.clipboard.writeText(url).then(() => {
                    alert('Ссылка скопирована в буфер обмена');
                  }).catch(() => {});
                  setShareModalOpen(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Копировать ссылку
              </button>
            </div>

            <button className="share-modal__close" onClick={() => setShareModalOpen(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Vision alert — model doesn't support images */}
      {visionAlert && (
        <div className="modal-overlay" onClick={() => setVisionAlert(null)}>
          <div className="vision-alert" onClick={e => e.stopPropagation()}>
            <div className="vision-alert__icon">🖼️</div>
            <div className="vision-alert__title">Для изображений нужна другая модель</div>
            <div className="vision-alert__text">
              <strong>{visionAlert.modelName}</strong> не поддерживает изображения.
              Текстовые файлы, PDF и документы прикрепляются без ограничений.
              Выберите одну из моделей с поддержкой vision:
            </div>
            <div className="vision-alert__models">
              {visionAlert.visionModels.map(m => (
                <button
                  key={m.id}
                  className="vision-alert__model-btn"
                  onClick={() => {
                    handleSelectModel(m);
                    setVisionAlert(null);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <button className="vision-alert__continue" onClick={() => setVisionAlert(null)}>
              Продолжить без изображения
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
