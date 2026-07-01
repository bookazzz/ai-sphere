
interface Props { onSelect: (text: string) => void; }

const prompts = [
  'Напиши пост для Telegram о новом AI-сервисе',
  'Сравни React и Vue для中型 проекта',
  'Напиши структуру статьи на 5000 символов',
  'Объясни разницу между SQL и NoSQL',
];

export default function ChatPlaceholder({ onSelect }: Props) {
  return (
    <div className="chat__placeholder">
      <div className="chat__placeholder-title">Примеры запросов</div>
      <div className="chat__placeholder-grid">
        {prompts.map((p, i) => (
          <button key={i} className="chat__placeholder-card" onClick={() => onSelect(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
