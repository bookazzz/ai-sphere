import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QuickActions from './QuickActions';
import ChatPlaceholder from './ChatPlaceholder';
import TaskHub from './TaskHub';
import { checkFacts, uploadFile, punctuateText, ensembleChat, sendFeedback, getGeneration, estimateTask, recordProductEvent, type GenerationInfo, type FactCheckResult, type ContentPart, type ChatMessage, type TaskEstimate, type TaskRunContext, type TaskTemplate } from '@/lib/api';
import { categories, allModels, DEFAULT_MODEL_ID, isVisionCapable, filterVisionModels, loadModelsFromApi, subscribeToModelsUpdates, type ModelItem } from '@/lib/models-data';

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
    void recordProductEvent({ event_name: 'result_downloaded', metadata: { result_kind: 'image' } });
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
      <button className="chat__image-download-btn" onClick={handleDownload} title="РЎРєР°С‡Р°С‚СЊ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>
  );
}

function GenerationCard({ initial }: { initial: GenerationInfo }) {
  const [generation, setGeneration] = useState(initial);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const closeLightboxRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lightbox) return;
    closeLightboxRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [lightbox]);

  useEffect(() => {
    if (!['pending', 'processing'].includes(generation.status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const fresh = await getGeneration(generation.id);
        if (!active) return;
        setGeneration(fresh);
        if (['pending', 'processing'].includes(fresh.status)) timer = setTimeout(poll, 5000);
      } catch {
        if (active) timer = setTimeout(poll, 10000);
      }
    };
    timer = setTimeout(poll, 2000);
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [generation.id, generation.status]);

  const statusLabel: Record<GenerationInfo['status'], string> = {
    pending: 'Р’ РѕС‡РµСЂРµРґРё', processing: 'РЎРѕР·РґР°С‘Рј', completed: 'Р“РѕС‚РѕРІРѕ',
    failed: 'РћС€РёР±РєР°', expired: 'РЎСЂРѕРє С…СЂР°РЅРµРЅРёСЏ РёСЃС‚С‘Рє',
  };

  return (
    <section className={`chat__generation-card chat__generation-card--${generation.status}`} aria-live="polite">
      <header className="chat__generation-header">
        <div>
          <strong>{generation.kind === 'image' ? 'РР·РѕР±СЂР°Р¶РµРЅРёРµ' : 'Р’РёРґРµРѕ'}</strong>
          <span>РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРѕ С‡РµСЂРµР· {generation.effective_model_name}</span>
        </div>
        <span className="chat__generation-status">{statusLabel[generation.status]}</span>
      </header>
      {['pending', 'processing'].includes(generation.status) && (
        <div className="chat__generation-loading"><span />Р“РµРЅРµСЂР°С†РёСЏ РјРѕР¶РµС‚ Р·Р°РЅСЏС‚СЊ РЅРµСЃРєРѕР»СЊРєРѕ РјРёРЅСѓС‚</div>
      )}
      {generation.status === 'failed' && <div className="chat__generation-error">{generation.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚'}</div>}
      {generation.status === 'expired' && <div className="chat__generation-error">Р¤Р°Р№Р» СѓРґР°Р»С‘РЅ РїРѕСЃР»Рµ 30 РґРЅРµР№ С…СЂР°РЅРµРЅРёСЏ.</div>}
      {generation.status === 'completed' && (
        <div className="chat__generation-assets">
          {generation.assets.map(asset => asset.type === 'image' ? (
            <div className="chat__generation-asset" key={asset.id}>
              <button className="chat__generation-preview" onClick={() => setLightbox(asset.url)} aria-label="РћС‚РєСЂС‹С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ">
                <img src={asset.url} alt="РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ" />
              </button>
              <a className="chat__generation-download" href={asset.url} download onClick={() => void recordProductEvent({event_name:'result_downloaded',model:generation.effective_model,metadata:{result_kind:'image'}})}>РЎРєР°С‡Р°С‚СЊ</a>
            </div>
          ) : (
            <div className="chat__generation-asset" key={asset.id}>
              <video src={asset.url} controls playsInline preload="metadata" />
              <a className="chat__generation-download" href={asset.url} download onClick={() => void recordProductEvent({event_name:'result_downloaded',model:generation.effective_model,metadata:{result_kind:'video'}})}>РЎРєР°С‡Р°С‚СЊ РІРёРґРµРѕ</a>
            </div>
          ))}
        </div>
      )}
      <footer className="chat__generation-meta">
        {Object.values(generation.parameters).filter(value => value !== false).map(String).join(' В· ')}
        {generation.credits_spent > 0 ? ` В· ${generation.credits_spent} РєСЂРµРґРёС‚РѕРІ` : ''}
      </footer>
      {lightbox && (
        <div className="chat__lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button ref={closeLightboxRef} onClick={() => setLightbox(null)} aria-label="Р—Р°РєСЂС‹С‚СЊ">Г—</button>
          <img src={lightbox} alt="РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РєСЂСѓРїРЅС‹Рј РїР»Р°РЅРѕРј" onClick={event => event.stopPropagation()} />
        </div>
      )}
    </section>
  );
}

// Extract plain text from a message content (string or content array)
function getMessageText(content: string | { type: string; [key: string]: any }[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(p => p.type === 'text');
    return textPart?.text || '[РёР·РѕР±СЂР°Р¶РµРЅРёРµ]';
  }
  return '';
}

function capabilityTags(model: ModelItem): string[] {
  const tags: string[] = [];
  if (model.outputModalities?.includes('text')) tags.push('РўРµРєСЃС‚');
  if (model.inputModalities?.includes('image')) tags.push('Р¤РѕС‚Рѕ-РІС…РѕРґ');
  if (model.outputModalities?.includes('image')) tags.push('РљР°СЂС‚РёРЅРєРё');
  if (model.inputModalities?.includes('video')) tags.push('Р’РёРґРµРѕ-РІС…РѕРґ');
  if (model.outputModalities?.includes('video')) tags.push('Р’РёРґРµРѕ');
  if (model.inputModalities?.includes('file')) tags.push('PDF');
  return tags.length ? tags : ['РўРµРєСЃС‚'];
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

  // Parse ![generated](url) from markdown text вЂ” extract as real image URLs
  const generatedImages: string[] = [];
  let cleanContent = textContent;
  if (typeof textContent === 'string') {
    const genRegex = /!\[generated\]\(([^)]+)\)/g;
    let match;
    while ((match = genRegex.exec(textContent)) !== null) {
      generatedImages.push(match[1]);
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

  // User message вЂ” plain text
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
  onSendMessage: (text: string, files?: FileItem[], context?: TaskRunContext) => void;
  onOpenAuth: () => void;
  onToggleSidebar: () => void;
  onUpdateModel: (modelId: string) => void;
  messages: ChatMessage[];
  sending?: boolean;
  thinkingText?: string;
  chatActive?: boolean;
  onDeleteChat?: () => void;
  onShareChat?: () => void;
  onEnsembleResult?: (text: string, files: FileItem[] | undefined, result: any) => void;
  onActivateChat?: () => void;
  onRegenerate?: () => void;
  currentSessionId?: string | null;
  userCredits?: number;
  onOpenPricing?: () => void;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  url: string;
  dataUrl?: string;
  type?: string;
  extractedText?: string;
  uploading?: boolean;
  error?: string;
}

export default function ChatSection({ isMobile: _isMobile, sidebarOpen, isLoggedIn, onSendMessage, onOpenAuth, onToggleSidebar, onUpdateModel, messages = [], sending = false, thinkingText = '', chatActive = false, onDeleteChat, onShareChat: _onShareChat, onEnsembleResult, onActivateChat, onRegenerate, currentSessionId, userCredits, onOpenPricing }: ChatSectionProps) {
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('all');
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(
    allModels.find(m => m.id === DEFAULT_MODEL_ID) || allModels[0]
  );
  const [autoModel, setAutoModel] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<TaskTemplate | null>(null);
  const [estimate, setEstimate] = useState<TaskEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [mediaPreferences, setMediaPreferences] = useState<Record<string, unknown>>({});
  const currentModel: ModelItem = selectedModel ?? { id: '', name: 'Р—Р°РіСЂСѓР·РєР° РјРѕРґРµР»РµР№вЂ¦', price: 0 };
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
  const estimateTrackedRef = useRef<Set<number>>(new Set());
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const [visionAlert, setVisionAlert] = useState<{ modelName: string; visionModels: typeof allModels } | null>(null);
  const [factCheckResults, setFactCheckResults] = useState<Record<number, FactCheckResult>>({});
  const [factCheckLoading, setFactCheckLoading] = useState<number | null>(null);
  const [ensembleLoading, setEnsembleLoading] = useState(false);
  const [ensembleError, setEnsembleError] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  const taskContext = useCallback((): TaskRunContext | undefined => activeTemplate ? ({
    templateId: activeTemplate.id,
    taskType: activeTemplate.task_type,
    mediaPreferences,
  }) : undefined, [activeTemplate, mediaPreferences]);

  const handleSelectTemplate = useCallback((template: TaskTemplate) => {
    setActiveTemplate(template);
    setMediaPreferences(template.default_parameters || {});
    setAutoModel(true);
    onUpdateModel('auto');
    setUserStarted(true);
  }, [onUpdateModel]);

  useEffect(() => {
    if (!activeTemplate) {
      setEstimate(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setEstimateLoading(true);
      estimateTask({
        template_id: activeTemplate.id,
        task_type: activeTemplate.task_type,
        model: autoModel ? 'auto' : currentModel.id,
        prompt: message,
        media_preferences: mediaPreferences,
      }).then(value => {
        if (active) {
          setEstimate(value);
          if (!estimateTrackedRef.current.has(activeTemplate.id)) {
            estimateTrackedRef.current.add(activeTemplate.id);
            void recordProductEvent({
              event_name: 'estimate_viewed', template_id: activeTemplate.id,
              task_type: activeTemplate.task_type, model: value.effective_model,
              metadata: { credits: value.exact ? value.credits_min : `${value.credits_min}-${value.credits_max}` },
            });
          }
        }
      }).catch(() => {
        if (active) setEstimate(null);
      }).finally(() => {
        if (active) setEstimateLoading(false);
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [activeTemplate, autoModel, currentModel.id, mediaPreferences, message]);

  useEffect(() => {
    const closeOverlays = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setModelSelectOpen(false);
      setHeaderModalOpen(false);
      setShareModalOpen(false);
      setVisionAlert(null);
    };
    document.addEventListener('keydown', closeOverlays);
    return () => document.removeEventListener('keydown', closeOverlays);
  }, []);

  // Load models from API on mount (async update)
  useEffect(() => {
    loadModelsFromApi().then(() => {
      const updated = allModels.find(m => m.id === selectedModel?.id)
        || allModels.find(m => m.id === DEFAULT_MODEL_ID)
        || allModels[0];
      if (updated) setSelectedModel(updated);
    });
  }, [selectedModel?.id]);

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

    setUiError(null);
    // Check multimodal input compatibility before uploading large files.
    const isImageFile = (f: File) => f.type.startsWith('image/');
    const isVideoFile = (f: File) => f.type.startsWith('video/');
    const hasImages = Array.from(selected).some(isImageFile);
    const hasVideos = Array.from(selected).some(isVideoFile);
    if (hasImages && !autoModel && !isVisionCapable(currentModel.id)) {
      const visionModels = filterVisionModels();
      setVisionAlert({
        modelName: currentModel.name,
        visionModels: visionModels.slice(0, 5),
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (hasVideos && !currentModel.inputModalities?.includes('video')) {
      setUiError(`РњРѕРґРµР»СЊ В«${currentModel.name}В» РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Р°РЅР°Р»РёР· РІРёРґРµРѕ. Р’С‹Р±РµСЂРёС‚Рµ РјРѕРґРµР»СЊ СЃ С‚РµРіРѕРј В«Р’РёРґРµРѕ-РІС…РѕРґВ».`);
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
        const result = await uploadFile(file, currentSessionId);
        const idx = newFiles.length - 1;
        newFiles[idx] = { ...result, uploading: false, dataUrl, extractedText: result.extracted_text };
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
  const filteredCategories = categories
    .map(cat => ({
      ...cat,
      models: cat.models.filter(m =>
        m.name.toLowerCase().includes(modelSearch.toLowerCase()) &&
        (capabilityFilter === 'all' || m.inputModalities?.includes(capabilityFilter) || m.outputModalities?.includes(capabilityFilter))
      ),
    }))
    .filter(cat => cat.models.length > 0);

  const handleSelectModel = (model: typeof allModels[0]) => {
    setSelectedModel(model);
    setAutoModel(false);
    onUpdateModel(model.id);
    setModelSelectOpen(false);
    setModelSearch('');
  };

  const handleSelectAuto = () => {
    setAutoModel(true);
    onUpdateModel('auto');
    setModelSelectOpen(false);
    setModelSearch('');
  };

  // в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ Voice Input в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  const startVoiceInput = useCallback(() => {
    if (!isLoggedIn) {
      onOpenAuth();
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setUiError('Р“РѕР»РѕСЃРѕРІРѕР№ РІРІРѕРґ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚СЃСЏ РІ СЌС‚РѕРј Р±СЂР°СѓР·РµСЂРµ. РСЃРїРѕР»СЊР·СѓР№С‚Рµ Chrome РёР»Рё Edge.');
      return;
    }

    if (isRecording) {
      // Stop recording вЂ” clear ref so onend doesn't auto-restart
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

    // Accumulated final transcript вЂ” persists across manual restarts
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
      if (event.error === 'not-allowed') {
        setUiError('Р”РѕСЃС‚СѓРї Рє РјРёРєСЂРѕС„РѕРЅСѓ Р·Р°РїСЂРµС‰С‘РЅ. Р Р°Р·СЂРµС€РёС‚Рµ РґРѕСЃС‚СѓРї РІ РЅР°СЃС‚СЂРѕР№РєР°С… Р±СЂР°СѓР·РµСЂР°.');
      } else if (event.error === 'no-speech') {
        // Silent вЂ” user just didn't speak
      } else {
        setUiError(`РћС€РёР±РєР° СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ: ${event.error}`);
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
        // Natural silence вЂ” punctuate the transcript and auto-send
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

  // в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ Fact Check в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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

      const result = await checkFacts(currentModel.id, prompt, responseText);
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
      if (e.name === 'AbortError') {
        setEnsembleError('РўР°Р№РјР°СѓС‚: РјРѕРґРµР»Рё РЅРµ РѕС‚РІРµС‚РёР»Рё Р·Р° 60 СЃРµРєСѓРЅРґ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·.');
      } else {
        setEnsembleError(e.message || 'РћС€РёР±РєР° РїСЂРё Р·Р°РїСЂРѕСЃРµ Ensemble');
      }
    } finally {
      setEnsembleLoading(false);
    }
  }, [message, files, ensembleLoading, isLoggedIn, onEnsembleResult, onActivateChat]);

  if (!selectedModel) {
    return (
      <main className="chat">
        <div className="chat__placeholder">
          <h1 className="chat__title">Р РµС€РёС‚Рµ Р·Р°РґР°С‡Сѓ СЃ AI вЂ” Р±РµР· СЃР»РѕР¶РЅС‹С… РЅР°СЃС‚СЂРѕРµРє</h1>
          <p>Р Р°Р±РѕС‚Р°Р№С‚Рµ СЃ С‚РµРєСЃС‚РѕРј, РґРѕРєСѓРјРµРЅС‚Р°РјРё, РёР·РѕР±СЂР°Р¶РµРЅРёСЏРјРё Рё РІРёРґРµРѕ РІ РѕРґРЅРѕРј РёРЅС‚РµСЂС„РµР№СЃРµ.</p>
          <span aria-live="polite">Р—Р°РіСЂСѓР·РєР° РґРѕСЃС‚СѓРїРЅС‹С… РјРѕРґРµР»РµР№вЂ¦</span>
        </div>
      </main>
    );
  }

  return (
    <main className={`chat ${chatActive || (isLoggedIn && messages.length > 0) ? 'chat--active' : ''}`}>
      {/* Mobile header вЂ” always rendered, visibility via CSS */}
      <div className="chat__mobile-header">
        <button
          className="chat__mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ' : 'РћС‚РєСЂС‹С‚СЊ РјРµРЅСЋ'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
        <span className="chat__mobile-logo">AI-Sphere</span>
        <div className="chat__mobile-actions">
        {isLoggedIn && <button className="chat__mobile-balance" onClick={onOpenPricing} aria-label="РџРѕРїРѕР»РЅРёС‚СЊ Р±Р°Р»Р°РЅСЃ">{(userCredits || 0).toLocaleString('ru-RU')} РєСЂ. пј‹</button>}
        <button className="chat__mobile-menu-btn" aria-label="РњРµРЅСЋ" onClick={() => setHeaderModalOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        </div>
      </div>

      {!chatActive && messages.length === 0 ? (
        <div className="chat__welcome">
          <h1 className="chat__title">Р РµС€РёС‚Рµ Р·Р°РґР°С‡Сѓ СЃ AI вЂ” Р±РµР· РІС‹Р±РѕСЂР° СЃР»РѕР¶РЅС‹С… РЅР°СЃС‚СЂРѕРµРє</h1>
          <p className="chat__subtitle">
            РўРµРєСЃС‚, РґРѕРєСѓРјРµРЅС‚С‹, РёР·РѕР±СЂР°Р¶РµРЅРёСЏ Рё РІРёРґРµРѕ РІ РѕРґРЅРѕРј РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµ. AIвЂ‘Sphere СЃР°Рј РїРѕРґР±РµСЂС‘С‚ РґРѕСЃС‚СѓРїРЅСѓСЋ РјРѕРґРµР»СЊ Рё Р·Р°СЂР°РЅРµРµ РїРѕРєР°Р¶РµС‚ СЃС‚РѕРёРјРѕСЃС‚СЊ.
          </p>
        </div>
      ) : (
        <div className="chat__messages" ref={messagesContainerRef}>
          {messages.map((msg, i) => {
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
         aria-label="РљРѕРїРёСЂРѕРІР°С‚СЊ"
         title="РљРѕРїРёСЂРѕРІР°С‚СЊ"
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
                  <span className="chat__message-model-name">{msg.effective_model_name || msg.effective_model || currentModel.name}</span>
                </div>
                <RenderContent content={msg.content} role="assistant" />
                {msg.generation && <GenerationCard initial={msg.generation} />}
                <div className="chat__message-actions">
                  <button
                    className={`chat__action-btn${copiedIndex === i ? ' chat__action-btn--active' : ''}`}
                    onClick={() => {
                      navigator.clipboard.writeText(getMessageText(msg.content));
                      setCopiedIndex(i);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    aria-label="РљРѕРїРёСЂРѕРІР°С‚СЊ"
                    title="РљРѕРїРёСЂРѕРІР°С‚СЊ"
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
                          model: currentModel.id,
                        }).catch(() => {});
                      }
                    }}
                    aria-label="РќСЂР°РІРёС‚СЃСЏ"
                    title="РќСЂР°РІРёС‚СЃСЏ"
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
                          model: currentModel.id,
                        }).catch(() => {});
                      }
                    }}
                    aria-label="РќРµ РЅСЂР°РІРёС‚СЃСЏ"
                    title="РќРµ РЅСЂР°РІРёС‚СЃСЏ"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                    </svg>
                  </button>
                  <button
                    className="chat__action-btn"
                    onClick={() => onRegenerate?.()}
                    disabled={sending}
                    aria-label="РџРµСЂРµРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ"
                    title="РџРµСЂРµРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ"
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
                        <span className="chat__factcheck-icon">рџ”Ќ</span>
                        <span className="chat__factcheck-label">Р¤Р°РєС‚-С‡РµРє</span>
                        <span className={`chat__factcheck-score ${factCheckResults[i].confidence >= 80 ? 'chat__factcheck-score--high' : factCheckResults[i].confidence >= 50 ? 'chat__factcheck-score--mid' : 'chat__factcheck-score--low'}`}>
                          {factCheckResults[i].confidence}%
                        </span>
                      </div>
                      {factCheckResults[i].errors.length > 0 && (
                        <div className="chat__factcheck-errors">
                          {factCheckResults[i].errors.map((e, ei) => (
                            <div key={ei} className="chat__factcheck-claim chat__factcheck-claim--error">
                              <div className="chat__factcheck-claim-text">вњ— {e.claim}</div>
                              {e.correction && <div className="chat__factcheck-correction">в†’ {e.correction}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {factCheckResults[i].verified_claims.filter(c => c.status === 'correct').length > 0 && (
                        <div className="chat__factcheck-verified">
                          {factCheckResults[i].verified_claims.filter(c => c.status === 'correct').map((c, ci) => (
                            <div key={ci} className="chat__factcheck-claim chat__factcheck-claim--ok">
                              <div className="chat__factcheck-claim-text">вњ“ {c.claim}</div>
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
                        <><span className="chat__factcheck-spinner" /> РџСЂРѕРІРµСЂРєР°...</>
                      ) : (
                        'рџ”Ќ РџСЂРѕРІРµСЂРёС‚СЊ С„Р°РєС‚С‹'
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
                <span className="chat__message-model-name">{currentModel.name}</span>
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

      {!chatActive && messages.length === 0 && (
        <TaskHub selected={activeTemplate} onSelect={handleSelectTemplate} />
      )}

      {activeTemplate && (
        <div className="task-context" aria-live="polite">
          <div className="task-context__top">
            <strong>{activeTemplate.title}</strong>
            <span>{activeTemplate.required_input}</span>
            <button
              type="button"
              className="task-context__close"
              aria-label="РЎР±СЂРѕСЃРёС‚СЊ СЃС†РµРЅР°СЂРёР№"
              onClick={() => { setActiveTemplate(null); setEstimate(null); setMediaPreferences({}); }}
            >Г—</button>
          </div>
          <div className="task-context__details">
            <span><b>РџСЂРёРјРµСЂ:</b> {activeTemplate.example_input}</span>
            <span><b>Р РµР·СѓР»СЊС‚Р°С‚:</b> {activeTemplate.example_output}</span>
          </div>
          {activeTemplate.category === 'image' && activeTemplate.task_type === 'create_image' && (
            <div className="task-context__controls">
              <label>Р¤РѕСЂРјР°С‚
                <select value={String(mediaPreferences.aspect_ratio || '1:1')} onChange={event => setMediaPreferences(prev => ({ ...prev, aspect_ratio: event.target.value }))}>
                  <option value="1:1">1:1</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="4:3">4:3</option>
                </select>
              </label>
              <label>Р Р°Р·СЂРµС€РµРЅРёРµ
                <select value={String(mediaPreferences.resolution || '1K')} onChange={event => setMediaPreferences(prev => ({ ...prev, resolution: event.target.value }))}>
                  <option value="1K">1K</option><option value="2K">2K</option>
                </select>
              </label>
            </div>
          )}
          {activeTemplate.category === 'video' && (
            <div className="task-context__controls">
              <label>Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ
                <select value={String(mediaPreferences.duration || 5)} onChange={event => setMediaPreferences(prev => ({ ...prev, duration: Number(event.target.value) }))}>
                  <option value="5">5 СЃРµРєСѓРЅРґ</option><option value="10">10 СЃРµРєСѓРЅРґ</option>
                </select>
              </label>
              <label>Р¤РѕСЂРјР°С‚
                <select value={String(mediaPreferences.aspect_ratio || '16:9')} onChange={event => setMediaPreferences(prev => ({ ...prev, aspect_ratio: event.target.value }))}>
                  <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option>
                </select>
              </label>
            </div>
          )}
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
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/mpeg,video/quicktime,video/webm,.pdf,.txt,.csv,.docx,.xlsx"
          />

          <div className={`chat__input-box${files.length > 0 ? ' has-files' : ''}`}>
          {files.length > 0 && (
            <div className="chat__file-list">
              {files.map(file => (
                <div
                  key={file.id}
                  className={`chat__file-chip ${file.uploading ? 'chat__file-chip--uploading' : ''} ${file.error ? 'chat__file-chip--error' : ''}`}
                  title={file.error || file.name}
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
                    aria-label="РЈРґР°Р»РёС‚СЊ С„Р°Р№Р»"
                  >
                    вњ•
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="chat__input"
            placeholder="Р—Р°РіСЂСѓР·РёС‚Рµ РґРѕРєСѓРјРµРЅС‚ РёР»Рё РѕРїРёС€РёС‚Рµ Р·Р°РґР°С‡Сѓ..."
            rows={3}
            value={message}
            onChange={e => {
              if (!message && e.target.value) void recordProductEvent({
                event_name: 'input_started', template_id: activeTemplate?.id || null,
                task_type: activeTemplate?.task_type || 'text', model: currentModel.id,
              });
              setMessage(e.target.value);
            }}
            onFocus={() => setUserStarted(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && (message.trim() || files.length > 0)) {
                e.preventDefault();
                if (isRecording) {
                  recognitionRef.current?.stop();
                  recognitionRef.current = null;
                  setIsRecording(false);
                }
                if (sending || uploading) return;
                onSendMessage(message, files.filter(file => !file.error && !file.uploading), taskContext());
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
                aria-label="РџСЂРёРєСЂРµРїРёС‚СЊ С„Р°Р№Р»"
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
                aria-label="Р’С‹Р±СЂР°С‚СЊ РјРѕРґРµР»СЊ"
              >
                <span className="chat__model-dot" />
                {autoModel ? 'AIвЂ‘Sphere СЂРµРєРѕРјРµРЅРґСѓРµС‚' : currentModel.name}
                <span className="chat__model-arrow">в–ј</span>
              </button>
              {modelSelectOpen && (
                <div className="chat__model-select chat__model-select--grouped">
                  {/* Search */}
                  <div className="chat__model-search">
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="chat__model-search-input"
                      placeholder="РџРѕРёСЃРє РјРѕРґРµР»РµР№..."
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                    />
                    <div className="chat__model-filters" aria-label="Р¤РёР»СЊС‚СЂ РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№">
                      {[
                        ['all', 'Р’СЃРµ'], ['text', 'РўРµРєСЃС‚'], ['image', 'Р¤РѕС‚Рѕ'], ['video', 'Р’РёРґРµРѕ'], ['file', 'PDF'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={capabilityFilter === value ? 'is-active' : ''}
                          onClick={() => setCapabilityFilter(value)}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Grouped list */}
                  <div className="chat__model-groups">
                    <div className="chat__model-group">
                      <div className="chat__model-group-title">РђРІС‚РѕРІС‹Р±РѕСЂ</div>
                      <button
                        type="button"
                        className={`chat__model-option ${autoModel ? 'chat__model-option--active' : ''}`}
                        onClick={handleSelectAuto}
                      >
                        <span className="chat__model-option-name">
                          <span>AIвЂ‘Sphere СЂРµРєРѕРјРµРЅРґСѓРµС‚</span>
                          <span className="chat__model-tags"><small>С†РµРЅР° + РєР°С‡РµСЃС‚РІРѕ + РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ</small></span>
                        </span>
                        <span className="chat__model-price">Р°РІС‚Рѕ</span>
                      </button>
                    </div>
                    {filteredCategories.map(cat => (
                      <div key={cat.name} className="chat__model-group">
                        <div className="chat__model-group-title">{cat.name}</div>
                        {cat.models.map(m => (
                          <button
                            key={m.id}
                            className={`chat__model-option ${m.id === currentModel.id ? 'chat__model-option--active' : ''}`}
                            onClick={() => handleSelectModel(m)}
                          >
                            <span className="chat__model-option-name">
                              <span>{m.name}</span>
                              <span className="chat__model-tags">{capabilityTags(m).map(tag => <small key={tag}>{tag}</small>)}</span>
                            </span>
                            <span className="chat__model-price">{m.price} РєСЂ.</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {filteredCategories.length === 0 && (
                      <div className="chat__model-empty">РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ</div>
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
                aria-label={isRecording ? 'РћСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РїРёСЃСЊ' : 'Р“РѕР»РѕСЃРѕРІРѕР№ РІРІРѕРґ'}
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
                if (sending || uploading) return;
                onSendMessage(message, files.filter(file => !file.error && !file.uploading), taskContext());
                setMessage('');
                setFiles([]);
              }}
                disabled={sending || uploading || (!message.trim() && files.length === 0)}
                aria-label="РћС‚РїСЂР°РІРёС‚СЊ"
              >
                в†‘
              </button>
            </div>
          </div>
        </div>
        </div>

        {uiError && (
          <div className="chat__inline-error" role="alert">
            {uiError}
            <button type="button" onClick={() => setUiError(null)} aria-label="Р—Р°РєСЂС‹С‚СЊ">Г—</button>
          </div>
        )}

        {isLoggedIn && message.trim() && (
        <div className="chat__ensemble-row">
          <button
            className="chat__ensemble-btn"
            onClick={handleEnsemble}
            disabled={ensembleLoading || !message.trim()}
          >
            {ensembleLoading ? (
              <><span className="chat__ensemble-spinner" /> РћРїСЂР°С€РёРІР°РµРј 3 РјРѕРґРµР»Рё...</>
            ) : (
              'рџ§  РЈС‚РѕС‡РЅРёС‚СЊ Сѓ 3 РјРѕРґРµР»РµР№'
            )}
          </button>
        </div>
        )}

        {ensembleError && (
        <div className="chat__ensemble-error">
          вљ пёЏ {ensembleError}
          <button className="chat__ensemble-error-close" onClick={() => setEnsembleError(null)}>вњ•</button>
        </div>
        )}

        <div className="chat__cost-hint chat__cost-hint--live">
          {estimateLoading ? 'Р Р°СЃСЃС‡РёС‚С‹РІР°РµРј СЃС‚РѕРёРјРѕСЃС‚СЊвЂ¦' : estimate ? (
            <><span>{estimate.exact ? 'РЎС‚РѕРёРјРѕСЃС‚СЊ:' : 'РџСЂРёРјРµСЂРЅР°СЏ СЃС‚РѕРёРјРѕСЃС‚СЊ:'}</span><strong>{estimate.exact ? `${estimate.credits_min}` : `${estimate.credits_min}вЂ“${estimate.credits_max}`} РєСЂРµРґРёС‚РѕРІ</strong><span>В· {estimate.effective_model_name}</span></>
          ) : (
            <span>Р”Р»СЏ С‚РµРєСЃС‚Р° СЃС‚РѕРёРјРѕСЃС‚СЊ Р·Р°РІРёСЃРёС‚ РѕС‚ РґР»РёРЅС‹ РѕС‚РІРµС‚Р°</span>
          )}
        </div>
        <div className="chat__cost-hint chat__cost-hint--legacy">
          РџСЂРёРјРµСЂРЅР°СЏ СЃС‚РѕРёРјРѕСЃС‚СЊ: РѕС‚ 1 РґРѕ 5 РєСЂРµРґРёС‚РѕРІ
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
            <div className="header-modal__title">Р”РµР№СЃС‚РІРёСЏ СЃ С‡Р°С‚РѕРј</div>

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
              РџРѕРґРµР»РёС‚СЊСЃСЏ С‡Р°С‚РѕРј
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
              РЈРґР°Р»РёС‚СЊ С‡Р°С‚
            </button>

            <button className="header-modal__close" onClick={() => setHeaderModalOpen(false)}>
              РћС‚РјРµРЅР°
            </button>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <div className="share-modal__title">РџРѕРґРµР»РёС‚СЊСЃСЏ С‡Р°С‚РѕРј</div>

            <div className="share-modal__grid">
              <button
                className="share-modal__btn"
                onClick={() => {
                  const url = window.location.href;
                  const text = messages.map(m => `${m.role === 'user' ? 'РЇ' : 'AI'}: ${getMessageText(m.content)}`).join('\n');
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
                  const text = messages.map(m => `${m.role === 'user' ? 'РЇ' : 'AI'}: ${getMessageText(m.content)}`).join('\n');
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
                  const text = messages.map(m => `${m.role === 'user' ? 'РЇ' : 'AI'}: ${getMessageText(m.content)}`).join('\n');
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
                    setUiError('РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР° РІ Р±СѓС„РµСЂ РѕР±РјРµРЅР°');
                  }).catch(() => {});
                  setShareModalOpen(false);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                РљРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ
              </button>
            </div>

            <button className="share-modal__close" onClick={() => setShareModalOpen(false)}>
              РћС‚РјРµРЅР°
            </button>
          </div>
        </div>
      )}

      {/* Vision alert вЂ” model doesn't support images */}
      {visionAlert && (
        <div className="modal-overlay" onClick={() => setVisionAlert(null)}>
          <div className="vision-alert" onClick={e => e.stopPropagation()}>
            <div className="vision-alert__icon">рџ–јпёЏ</div>
            <div className="vision-alert__title">Р”Р»СЏ РёР·РѕР±СЂР°Р¶РµРЅРёР№ РЅСѓР¶РЅР° РґСЂСѓРіР°СЏ РјРѕРґРµР»СЊ</div>
            <div className="vision-alert__text">
              <strong>{visionAlert.modelName}</strong> РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ.
              РўРµРєСЃС‚РѕРІС‹Рµ С„Р°Р№Р»С‹, PDF Рё РґРѕРєСѓРјРµРЅС‚С‹ РїСЂРёРєСЂРµРїР»СЏСЋС‚СЃСЏ Р±РµР· РѕРіСЂР°РЅРёС‡РµРЅРёР№.
              Р’С‹Р±РµСЂРёС‚Рµ РѕРґРЅСѓ РёР· РјРѕРґРµР»РµР№ СЃ РїРѕРґРґРµСЂР¶РєРѕР№ vision:
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
              РџСЂРѕРґРѕР»Р¶РёС‚СЊ Р±РµР· РёР·РѕР±СЂР°Р¶РµРЅРёСЏ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

