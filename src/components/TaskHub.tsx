'use client';

import { useEffect, useMemo, useState } from 'react';
import { exposeExperiment, fetchExperimentAssignment, fetchTaskTemplates, recordProductEvent, type TaskTemplate } from '@/lib/api';

const MODES = [
  { id: 'text', label: 'Текст', icon: '✦' },
  { id: 'document', label: 'Документы', icon: '▤' },
  { id: 'image', label: 'Изображения', icon: '◇' },
  { id: 'video', label: 'Видео', icon: '▶' },
] as const;

interface TaskHubProps {
  selected: TaskTemplate | null;
  onSelect: (template: TaskTemplate) => void;
}

export default function TaskHub({ selected, onSelect }: TaskHubProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('text');
  const [loading, setLoading] = useState(true);
  const [featuredOrder, setFeaturedOrder] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchTaskTemplates()
      .then(items => {
        setTemplates(items);
        const slug = new URLSearchParams(window.location.search).get('template');
        const requested = slug ? items.find(item => item.slug === slug) : undefined;
        if (requested) onSelect(requested);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [onSelect]);

  useEffect(() => {
    fetchExperimentAssignment('task_hub').then(assignment => {
      if (!assignment) return;
      const order = assignment.payload.featured_order;
      if (Array.isArray(order)) setFeaturedOrder(order.map(String));
      if (!assignment.exposed) void exposeExperiment(assignment.experiment_id);
      void recordProductEvent({ event_name: 'experiment_exposure', metadata: { surface: 'task_hub', variant_id: assignment.variant_id } });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected) {
      setMode(selected.category);
      setExpanded(true);
    }
  }, [selected]);

  const visible = useMemo(() => templates.filter(item => item.category === mode).sort((a, b) => {
    const ai = featuredOrder.indexOf(a.slug); const bi = featuredOrder.indexOf(b.slug);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  }), [templates, mode, featuredOrder]);

  const choose = (template: TaskTemplate) => {
    onSelect(template);
    void recordProductEvent({
      event_name: 'template_view',
      template_id: template.id,
      task_type: template.task_type,
      metadata: { source: 'task_hub' },
    }).catch(() => undefined);
  };

  return (
    <section className={`task-hub${expanded ? ' is-expanded' : ''}`} aria-labelledby="task-hub-title">
      <div className="task-hub__heading">
        <div>
          <span className="task-hub__eyebrow">С чего начнём?</span>
          <h2 id="task-hub-title">Выберите задачу — модель подберём сами</h2>
        </div>
        <span className="task-hub__auto-badge">AI‑Sphere рекомендует</span>
      </div>

      <div className="task-hub__modes" role="tablist" aria-label="Тип результата">
        {MODES.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={mode === item.id ? 'is-active' : ''}
            onClick={() => { setMode(item.id); setExpanded(false); }}
          >
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      <div className="task-hub__grid" role="tabpanel">
        {loading && <div className="task-hub__empty">Загружаем сценарии…</div>}
        {!loading && visible.map((template, index) => (
          <button
            type="button"
            key={template.id}
            className={`task-card${selected?.id === template.id ? ' is-selected' : ''}${index >= 2 ? ' task-card--extra' : ''}`}
            onClick={() => choose(template)}
          >
            <span className="task-card__icon" aria-hidden="true">
              {template.category === 'video' ? '▶' : template.category === 'image' ? '◇' : template.category === 'document' ? '▤' : '✦'}
            </span>
            <span className="task-card__body">
              <strong>{template.title}</strong>
              <small>{template.description}</small>
            </span>
            <span className="task-card__arrow" aria-hidden="true">→</span>
          </button>
        ))}
        {!loading && visible.length === 0 && (
          <div className="task-hub__empty">Сценарии этого типа скоро появятся.</div>
        )}
      </div>
      {!loading && visible.length > 2 && (
        <button
          type="button"
          className="task-hub__more"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? 'Скрыть дополнительные' : `Показать ещё (${visible.length - 2})`}
        </button>
      )}
    </section>
  );
}
