'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  createProject, deleteLibraryItem, deleteProject, fetchBillingUsage, fetchLibrary, fetchProjects,
  fetchPublicGallery, fetchPublicProjects, fetchRecipes, fetchPopularTemplates, updateLibraryItem,
  updateProject, reuseLibraryItem, recordProductEvent, type LibraryItem, type Project, type Recipe, type TaskTemplate, type UsageItem,
} from '@/lib/api';

type View = 'works' | 'projects' | 'popular';
const KIND_LABELS: Record<string, string> = { all: 'Все', chat: 'Чаты', document: 'Документы', image: 'Изображения', video: 'Видео' };
const STEP_LABELS: Record<string, string> = {
  brief: 'Идея', text: 'Текст', image: 'Изображение', document: 'Документ', summary: 'Краткое содержание',
  slides: 'План презентации', product: 'Товар', description: 'Описание', post: 'Пост', script: 'Сценарий', video: 'Видео',
};

function resumeWork(item: LibraryItem) {
  if (item.type === 'chat') {
    localStorage.setItem('ai_sphere_current_session', item.id);
  } else if (item.prompt) {
    sessionStorage.setItem('ai_sphere_pending_task', JSON.stringify({
      text: item.prompt,
      context: { taskType: item.type === 'image' ? 'create_image' : 'create_video' },
    }));
  }
  window.location.href = '/';
}

export default function WorkspaceClient({ view }: { view: View }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [gallery, setGallery] = useState<LibraryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [kind, setKind] = useState('all');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const request = view === 'works'
      ? Promise.all([fetchLibrary(kind, favoriteOnly), fetchBillingUsage()]).then(([nextItems, nextUsage]) => { setItems(nextItems); setUsage(nextUsage); })
      : view === 'projects'
        ? Promise.all([fetchRecipes(), fetchProjects()]).then(([nextRecipes, nextProjects]) => { setRecipes(nextRecipes); setProjects(nextProjects); })
        : Promise.all([fetchPopularTemplates(), fetchPublicGallery(), fetchPublicProjects(), fetchRecipes()]).then(([nextTemplates, nextGallery, nextProjects, nextRecipes]) => { setTemplates(nextTemplates); setGallery(nextGallery); setPublicProjects(nextProjects); setRecipes(nextRecipes); });
    request.catch(err => setError(err?.message || 'Не удалось загрузить данные')).finally(() => setLoading(false));
  }, [view, kind, favoriteOnly]);

  const recipeMap = useMemo(() => Object.fromEntries(recipes.map(recipe => [recipe.slug, recipe])), [recipes]);

  const createFromRecipe = async (recipe: Recipe) => {
    const created = await createProject(recipe.title, recipe.slug);
    setProjects(prev => [created, ...prev]);
  };

  const runStep = (project: Project, step: string) => {
    sessionStorage.setItem('ai_sphere_pending_task', JSON.stringify({
      text: `Помоги выполнить шаг «${STEP_LABELS[step] || step}» для проекта «${project.name}».`,
      context: { taskType: step === 'image' ? 'create_image' : step === 'video' ? 'create_video' : 'text' },
    }));
    window.location.href = '/';
  };

  return (
    <main className="workspace-page">
      <section className="workspace-hero">
        <span>Личное AI‑пространство</span>
        <h1>{view === 'works' ? 'Мои работы' : view === 'projects' ? 'Проекты и рецепты' : 'Популярное'}</h1>
        <p>{view === 'works' ? 'Все чаты и генерации в одном месте.' : view === 'projects' ? 'Последовательные задачи без сложной схемы: подтверждайте результат на каждом шаге.' : 'Проверенные сценарии и опубликованные авторами примеры.'}</p>
        <nav className="workspace-tabs">
          <Link className={view === 'works' ? 'is-active' : ''} href="/works">Мои работы</Link>
          <Link className={view === 'projects' ? 'is-active' : ''} href="/projects">Проекты</Link>
          <Link className={view === 'popular' ? 'is-active' : ''} href="/popular">Популярное</Link>
        </nav>
      </section>

      {loading && <div className="workspace-state">Загружаем…</div>}
      {error && <div className="workspace-state workspace-state--error">{error}<br /><Link href="/">Перейти в AI‑Sphere</Link></div>}

      {!loading && !error && view === 'works' && (
        <>
          <div className="workspace-toolbar">
            <div>{Object.entries(KIND_LABELS).map(([value, label]) => <button key={value} className={kind === value ? 'is-active' : ''} onClick={() => setKind(value)}>{label}</button>)}</div>
            <label><input type="checkbox" checked={favoriteOnly} onChange={event => setFavoriteOnly(event.target.checked)} /> Только избранное</label>
          </div>
          <div className="works-grid">
            {items.map(item => (
              <article className="work-card" key={`${item.type}-${item.id}`}>
                {item.assets?.[0] && (item.type === 'image' ? <img src={item.assets[0].url} alt="Результат генерации" /> : <video src={item.assets[0].url} controls preload="metadata" />)}
                <div className="work-card__content">
                  <span className="work-card__kind">{KIND_LABELS[item.type] || item.type}</span>
                  <h2>{item.title}</h2>
                  {item.model && <p>{item.model} · {item.credits_spent || 0} кредитов</p>}
                  <div className="work-card__actions">
                    <button onClick={async () => { await reuseLibraryItem(item.id); void recordProductEvent({ event_name:'result_reused', metadata:{ result_kind:item.type } }); resumeWork(item); }}>{item.type === 'chat' ? 'Продолжить' : 'Повторить'}</button>
                    {item.type !== 'chat' && <button title="Избранное" onClick={async () => { const next = await updateLibraryItem(item.id, { is_favorite: !item.is_favorite }); void recordProductEvent({event_name:'result_saved',metadata:{result_kind:item.type}}); setItems(prev => prev.map(value => value.id === next.id ? next : value)); }}>{item.is_favorite ? '★' : '☆'}</button>}
                    {item.type !== 'chat' && <button onClick={async () => { const next = await updateLibraryItem(item.id, { is_public: !item.is_public }); setItems(prev => prev.map(value => value.id === next.id ? next : value)); }}>{item.is_public ? 'Скрыть' : 'Опубликовать'}</button>}
                    {item.type !== 'chat' && item.is_public && <button onClick={async () => { const next = await updateLibraryItem(item.id, { allow_prompt: !item.allow_prompt }); setItems(prev => prev.map(value => value.id === next.id ? next : value)); }}>{item.allow_prompt ? 'Скрыть промпт' : 'Показать промпт'}</button>}
                    {item.type !== 'chat' && <button className="is-danger" onClick={async () => { if (!confirm('Удалить эту работу без возможности восстановления?')) return; await deleteLibraryItem(item.id); setItems(prev => prev.filter(value => value.id !== item.id)); }}>Удалить</button>}
                  </div>
                </div>
              </article>
            ))}
            {!items.length && <div className="workspace-state">Здесь пока пусто. <Link href="/">Создать первую работу</Link></div>}
          </div>
          <h2 className="workspace-section-title">История кредитов</h2>
          <div className="usage-list">
            {usage.map(entry => <div key={entry.id}><span>{entry.description}</span><time>{entry.created_at ? new Date(entry.created_at).toLocaleString('ru-RU') : ''}</time><strong className={entry.type === 'refund' ? 'is-refund' : ''}>{entry.type === 'refund' ? '+' : '−'}{Math.abs(entry.amount)} кр.</strong></div>)}
            {!usage.length && <div className="workspace-state">Списаний пока не было.</div>}
          </div>
        </>
      )}

      {!loading && !error && view === 'projects' && (
        <>
          <h2 className="workspace-section-title">Начать по готовому рецепту</h2>
          <div className="recipe-grid">
            {recipes.map(recipe => <article key={recipe.slug}><h2>{recipe.title}</h2><div className="recipe-steps">{recipe.steps.map((step, index) => <span key={step}>{index + 1}. {STEP_LABELS[step] || step}</span>)}</div><button onClick={() => createFromRecipe(recipe)}>Создать приватный проект</button></article>)}
          </div>
          <h2 className="workspace-section-title">Мои проекты</h2>
          <div className="project-list">
            {projects.map(project => {
              const recipe = recipeMap[project.recipe_slug];
              return <article key={project.id}>
                <div><span className="privacy-badge">{project.is_public ? '🌐 Публичный' : '🔒 Приватный'}</span><h2>{project.name}</h2></div>
                <div className="project-progress">{recipe?.steps.map((step, index) => <button key={step} className={index < project.current_step ? 'is-done' : index === project.current_step ? 'is-current' : ''} onClick={() => runStep(project, step)}><span>{index < project.current_step ? '✓' : index + 1}</span>{STEP_LABELS[step] || step}</button>)}</div>
                <div className="project-actions"><button disabled={!recipe || project.current_step >= recipe.steps.length} onClick={async () => { const next = await updateProject(project.id, { current_step: project.current_step + 1, status: project.current_step + 1 >= (recipe?.steps.length || 0) ? 'completed' : 'active' }); setProjects(prev => prev.map(value => value.id === next.id ? next : value)); }}>Подтвердить шаг</button><button onClick={async () => { const next = await updateProject(project.id, { is_public: !project.is_public }); setProjects(prev => prev.map(value => value.id === next.id ? next : value)); }}>{project.is_public ? 'Сделать приватным' : 'Опубликовать'}</button>{project.is_public && <button onClick={async () => { const next = await updateProject(project.id, { allow_prompt: !project.allow_prompt }); setProjects(prev => prev.map(value => value.id === next.id ? next : value)); }}>{project.allow_prompt ? 'Скрыть детали' : 'Показать детали'}</button>}<button className="is-danger" onClick={async () => { if (!confirm('Удалить проект?')) return; await deleteProject(project.id); setProjects(prev => prev.filter(value => value.id !== project.id)); }}>Удалить</button></div>
              </article>;
            })}
            {!projects.length && <div className="workspace-state">Выберите рецепт выше — проект будет приватным.</div>}
          </div>
        </>
      )}

      {!loading && !error && view === 'popular' && (
        <>
          <h2 className="workspace-section-title">Популярные сценарии</h2>
          <div className="popular-grid">{templates.map(template => <article key={template.id}><span>{template.category}</span><h2>{template.title}</h2><p>{template.description}</p><small>{template.estimated_credits_label}</small><Link href={`/?template=${template.slug}`}>Запустить →</Link></article>)}</div>
          {publicProjects.length > 0 && <><h2 className="workspace-section-title">Проекты сообщества</h2><div className="popular-grid">{publicProjects.map(project => <article key={project.id}><span>рецепт</span><h2>{project.name}</h2><p>{recipeMap[project.recipe_slug]?.title || project.recipe_slug}</p><button onClick={async () => { const copy = await createProject(`${project.name} — копия`, project.recipe_slug); window.location.href = `/projects#${copy.id}`; }}>Запустить свою копию →</button></article>)}</div></>}
          {gallery.length > 0 && <><h2 className="workspace-section-title">Публичная галерея</h2><div className="gallery-grid">{gallery.map(item => <article key={item.id}>{item.assets?.[0] && (item.type === 'image' ? <img src={item.assets[0].url} alt={item.title} /> : <video src={item.assets[0].url} controls />)}<div><h2>{item.title}</h2>{item.prompt && <p>{item.prompt}</p>}<button onClick={() => resumeWork(item)}>Создать свою версию</button></div></article>)}</div></>}
        </>
      )}
    </main>
  );
}
