
interface QuickActionsProps {
  onSelect: (text: string) => void;
}

const actions = [
  { icon: '📄', label: 'Загрузить документ', prompt: 'Загрузите документ для анализа' },
  { icon: '📝', label: 'Разобрать договор', prompt: 'Проанализируй этот договор, найди риски и спорные моменты' },
  { icon: '🌐', label: 'Перевести', prompt: 'Переведи следующий текст на русский язык' },
  { icon: '🎨', label: 'Создать изображение', prompt: 'Создай изображение по описанию' },
  { icon: '🔍', label: 'Найти в интернете', prompt: 'Найди актуальную информацию по запросу' },
];

export default function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {actions.map((action, i) => (
        <button key={i} className="quick-actions__btn" onClick={() => onSelect(action.prompt)}>
          <span className="quick-actions__btn-icon">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
