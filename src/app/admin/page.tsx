'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCall, getMe, loginAdmin, logoutUser } from '@/lib/api';

// ── Types ──

type Section = 'workspace'|'dashboard'|'users'|'models'|'plans'|'payments'|'credits'|'logs'|'errors'|'promo'|'roles'
  |'chats'|'queries'|'files'|'tickets'|'notifications'|'fraud'|'analytics'
  |'seo'|'referrals'|'forecast'|'cohorts'|'ltv'|'feedback'|'model-feedback'|'metrica'
  |'funnel'|'segments'|'abandoned'|'model-analytics'|'problems'|'surveys'|'triggers'|'categories'
  |'growth-overview'|'blockers'|'journeys'|'campaigns'|'gamification'|'experiments'|'growth-surveys';

interface Stats { period: string; revenue: number; revenue_growth: number; or_cost: number; registrations: number; requests: number; errors: number; total_users: number; active_now: number; paying_users: number; total_revenue: number; }
interface Warning { type: string; severity: string; message: string; }
interface UserItem { id: number; email: string; name: string|null; credits: number; credits_paid: number; credits_free: number; credits_bonus: number; credits_promo: number; is_active: boolean; is_admin: boolean; role_id: number|null; total_spent_rub: number; request_count: number; chat_count: number; last_seen: string|null; created_at: string; registered_by: string; }
interface ModelItem { id: number; name: string; provider: string; or_model_id: string; category: string; or_input_cost: number; or_output_cost: number; price_input: number; price_output: number; price_unit: number; price_mode: string; credits_in_1k: number; credits_out_1k: number; markup_factor: number; margin: number; margin_min: number; is_unprofitable: boolean; is_active: boolean; is_visible: boolean; vision: boolean; request_count: number; error_count: number; input_modalities: string[]; output_modalities: string[]; supported_parameters: Record<string, unknown>; openrouter_pricing: Record<string, unknown>; auto_route_enabled: boolean; or_last_synced_at: string|null; recommended_priority?: number; availability_status?: string; catalog_miss_count?: number; last_provider_error?: string; unit_basis: string; provider_cost_usd_unit: number|null; provider_cost_rub_unit: number|null; revenue_credits_unit: number; revenue_rub_unit: number; payment_fee_rub_unit: number; profit_rub_unit: number|null; }
interface PlanItem { id: number; name: string; price_rub: number; credits: number; bonus_credits: number; old_price_rub: number|null; badge: string|null; is_active: boolean; purchase_count: number; credit_price: number; }
interface TxItem { id: number; user_id: number; user_email: string; amount: number; rub_amount: number; type: string; description: string; payment_id: string|null; created_at: string; }
interface CreditOp { id: number; user_id: number; op_type: string; credit_type: string; amount: number; balance_before: number; balance_after: number; source: string; comment: string; created_at: string; }
interface LogItem { id: number; admin_id: number; admin_email: string; action: string; target_type: string; target_id: string|null; old_value: string; new_value: string; ip: string|null; result: string; detail: string; created_at: string; }
interface ErrorItem { id: number; error_code: string; error_text: string; service: string; repeat_count: number; status: string; created_at: string; }
interface RoleItem { id: number; name: string; description: string; is_system: boolean; }
interface PromoItem { id: number; code: string; credits: number; max_uses: number; used_count: number; description: string; is_active: boolean; expires_at: string|null; created_at: string; }
interface ChatItem { id: number; session_id: string; user_id: number; user_email: string; title: string; model: string; credits_spent: number; or_cost: number; message_count: number; created_at: string; updated_at: string; }
interface QueryItem { id: number; session_id: string; title: string; user_id: number; user_email: string; content: string; model: string; has_attachments: boolean; created_at: string; }
interface FileItem { id: number; user_id: number; chat_id: string|null; original_name: string; mime_type: string|null; size_bytes: number; status: string; is_blocked: boolean; error_text: string|null; created_at: string; }
interface TicketItem { id: number; user_id: number; user_email: string; subject: string; category: string; priority: string; status: string; assigned_to: number|null; assigned_email: string|null; message_count: number|null; last_message_at: string|null; created_at: string; }
interface NotifItem { id: number; title: string; text: string; audience: string; channel: string; is_active: boolean; sent_count: number; opened_count: number; starts_at: string|null; ends_at: string|null; created_at: string; }
interface FraudItem { id: number; user_id: number|null; alert_type: string; risk_level: string; ip_address: string|null; description: string; status: string; action_taken: string|null; created_at: string; }

const navSections: {title: string; items: {id: Section; label: string; icon: string}[]}[] = [
  {title: 'Обзор', items: [{id:'growth-overview', label:'Пульс проекта', icon:'◉'},{id:'funnel', label:'Воронка', icon:'▽'},{id:'blockers', label:'Что мешает', icon:'⚠'}]},
  {title: 'Пользователи', items: [{id:'users', label:'Все пользователи', icon:'👤'},{id:'journeys', label:'Путь пользователя', icon:'⌁'},{id:'segments', label:'Сегменты', icon:'◎'},{id:'queries', label:'Запросы', icon:'⌕'},{id:'chats', label:'Чаты', icon:'💬'}]},
  {title: 'Продукт', items: [{id:'workspace', label:'Сценарии и сервисы', icon:'✦'},{id:'categories', label:'Категории задач', icon:'▤'},{id:'model-feedback', label:'Качество ответов', icon:'👍'}]},
  {title: 'Монетизация', items: [{id:'payments', label:'Платежи', icon:'₽'},{id:'abandoned', label:'Брошенные оплаты', icon:'↘'},{id:'plans', label:'Пакеты кредитов', icon:'◆'},{id:'credits', label:'Операции', icon:'◈'},{id:'ltv', label:'LTV и Retention', icon:'↗'}]},
  {title: 'Вовлечение', items: [{id:'campaigns', label:'Кампании', icon:'◐'},{id:'growth-surveys', label:'Микроопросы', icon:'?'},{id:'gamification', label:'Миссии и награды', icon:'★'},{id:'experiments', label:'A/B‑тесты', icon:'A/B'},{id:'cohorts', label:'Когорты', icon:'▦'},{id:'referrals', label:'Партнёры', icon:'🤝'}]},
  {title: 'Операции', items: [{id:'models', label:'Модели', icon:'🤖'},{id:'errors', label:'Ошибки', icon:'!'},{id:'fraud', label:'Антифрод', icon:'🛡'},{id:'tickets', label:'Поддержка', icon:'🎫'},{id:'files', label:'Файлы', icon:'▣'}]},
  {title: 'Контент', items: [{id:'seo', label:'SEO-страницы', icon:'📝'},{id:'feedback', label:'Отзывы', icon:'💬'},{id:'promo', label:'Промокоды', icon:'🎟'}]},
  {title: 'Настройки', items: [{id:'roles', label:'Роли и доступ', icon:'🔐'},{id:'logs', label:'Аудит', icon:'▧'},{id:'metrica', label:'Яндекс Метрика', icon:'📊'}]},
];

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  return apiCall<T>(`/admin${path}`, opts);
}

// ── Main ──

export default function AdminPage() {
  const [auth, setAuth] = useState<boolean|null>(null);
  const [section, setSection] = useState<Section>('growth-overview');
  useEffect(() => {
    getMe()
      .then(user => user.is_admin === true)
      .then(setAuth).catch(()=>setAuth(false));
  }, []);
  if (auth === null) return <div className="admin"><div className="admin__loading">Проверка доступа...</div></div>;
  if (!auth) return <LoginForm onLogin={()=>setAuth(true)} />;
  return <AdminLayout section={section} onSection={setSection} />;
}

function WorkspaceAdminSection() {
  const [status,setStatus]=useState<any>(null);
  const [templates,setTemplates]=useState<any[]>([]);
  const [models,setModels]=useState<ModelItem[]>([]);
  const [error,setError]=useState('');
  const [syncing,setSyncing]=useState(false);
  const [editingTemplate,setEditingTemplate]=useState<any|null>(null);

  const load=useCallback(async()=>{
    setError('');
    try {
      const [nextStatus,nextTemplates,nextModels]=await Promise.all([
        api<any>('/integrations/status'),api<any[]>('/task-templates'),api<ModelItem[]>('/models'),
      ]);
      setStatus(nextStatus);setTemplates(nextTemplates);setModels(nextModels);
    } catch(e:any) { setError(e.message); }
  },[]);
  useEffect(()=>{void load()},[load]);

  const saveTemplate=async(template:any,changes:any)=>{
    const next={...template,...changes};
    const payload={
      slug:next.slug,title:next.title,description:next.description,category:next.category,
      task_type:next.task_type,prompt_template:next.prompt_template,example_input:next.example_input,
      example_output:next.example_output,required_input:next.required_input,preview_url:next.preview_url,
      default_parameters:next.default_parameters||{},preferred_model:next.preferred_model||'',
      fallback_models:next.fallback_models||[],estimated_credits_label:next.estimated_credits_label||'',
      is_featured:Boolean(next.is_featured),is_active:Boolean(next.is_active),sort_order:Number(next.sort_order||100),
    };
    await api(`/task-templates/${template.id}`,{method:'PUT',body:JSON.stringify(payload)});
    setTemplates(prev=>prev.map(item=>item.id===template.id?next:item));
  };
  const compatibleModels=(template:any)=>{
    const kind=template.category==='image'?'image':template.category==='video'?'video':'text';
    return models.filter(model=>model.is_active&&model.is_visible&&(model.output_modalities||[]).includes(kind)&&(
      template.task_type!=='analyze_image'||(model.input_modalities||[]).includes('image')
    )).sort((left,right)=>(left.recommended_priority||100)-(right.recommended_priority||100)||left.name.localeCompare(right.name,'ru'));
  };
  const modelOptions=(template:any)=>{
    const options=compatibleModels(template);
    const selected=template.preferred_model||'';
    const selectedAvailable=!selected||options.some(model=>model.or_model_id===selected);
    return <><option value="">AI‑Sphere выбирает автоматически</option>{!selectedAvailable&&<option value={selected}>Недоступна: {selected}</option>}{options.map(model=><option key={model.id} value={model.or_model_id}>{model.name} · {model.provider}</option>)}</>;
  };

  return <div>
    {error&&<div className="admin__error">{error}</div>}
    <div className="admin__stats" style={{marginBottom:20}}>
      <div className="admin__stat-card"><div className="admin__stat-label">OpenRouter</div><div className="admin__stat-value" style={{fontSize:22,color:status?.openrouter?.configured?'#00b894':'#e74c3c'}}>{status?.openrouter?.configured?'Подключён':'Не настроен'}</div><small>{status?.openrouter?.visible_models||0} видимых · {status?.openrouter?.unavailable_models||0} недоступны</small></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Последняя синхронизация</div><div className="admin__stat-value" style={{fontSize:16}}>{status?.openrouter?.last_sync?new Date(status.openrouter.last_sync).toLocaleString('ru-RU'):'Ещё не запускалась'}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Оплата</div><div className="admin__stat-value" style={{fontSize:22,color:status?.payments?.configured?'#00b894':'#e74c3c'}}>{status?.payments?.provider||'Platega'}: {status?.payments?.configured?'готова':'не настроена'}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Воронка</div><div style={{fontSize:12,marginTop:8}}>{Object.entries(status?.funnel||{}).map(([key,value])=><div key={key}>{key}: <b>{String(value)}</b></div>)}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Новый продуктовый контур</div><div style={{fontSize:12,marginTop:8}}>Baseline: {status?.analytics?.baseline?new Date(status.analytics.baseline).toLocaleString('ru-RU'):'—'}<br/>Кампании: {status?.features?.campaigns?'вкл':'выкл'} · Миссии: {status?.features?.gamification?'вкл':'выкл'} · A/B: {status?.features?.experiments?'вкл':'выкл'}</div></div>
    </div>
    <button className="admin__btn admin__btn--primary" disabled={syncing} onClick={async()=>{setSyncing(true);try{await api('/models/auto-update-prices',{method:'POST'});await load()}catch(e:any){setError(e.message)}finally{setSyncing(false)}}}>{syncing?'Синхронизация…':'Синхронизировать OpenRouter'}</button>

    <div className="admin__section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'28px 0 12px'}}><h3 style={{margin:0}}>Сценарии задач</h3><button className="admin__btn admin__btn--primary" onClick={()=>setEditingTemplate({slug:'',title:'',description:'',category:'text',task_type:'text',prompt_template:'{input}',example_input:'',example_output:'',required_input:'Текст запроса',preview_url:'',default_parameters:{},preferred_model:'',fallback_models:[],estimated_credits_label:'',is_featured:false,is_active:true,sort_order:100})}>+ Добавить сценарий</button></div>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Порядок</th><th>Сценарий</th><th>Категория</th><th>Основная модель</th><th>Fallback</th><th>Активен</th><th></th></tr></thead><tbody>
      {templates.map(template=><tr key={template.id}>
        <td><input className="admin__modal-input" style={{width:72}} type="number" defaultValue={template.sort_order} onBlur={event=>void saveTemplate(template,{sort_order:Number(event.target.value)})}/></td>
        <td><strong>{template.title}</strong><div style={{fontSize:11,color:'#8e8e9a'}}>{template.task_type} · использований {template.usage_count||0}</div></td>
        <td>{template.category}</td>
        <td><select className="admin__select admin__model-select" aria-label={`Основная модель для ${template.title}`} value={template.preferred_model||''} onChange={event=>void saveTemplate(template,{preferred_model:event.target.value}).catch(e=>setError(e.message))}>{modelOptions(template)}</select><div className="admin__field-hint">Пустое значение — безопасный автовыбор</div></td>
        <td><input className="admin__modal-input" defaultValue={(template.fallback_models||[]).join(', ')} placeholder="model/a, model/b" onBlur={event=>void saveTemplate(template,{fallback_models:event.target.value.split(',').map(value=>value.trim()).filter(Boolean)})}/></td>
        <td><label className="admin__toggle"><input type="checkbox" checked={template.is_active} onChange={event=>void saveTemplate(template,{is_active:event.target.checked})}/><span className="admin__toggle-slider"/></label></td>
        <td><button className="admin__btn admin__btn-sm" onClick={()=>setEditingTemplate({...template})}>Редактировать</button></td>
      </tr>)}
    </tbody></table></div>

    {editingTemplate&&<div className="admin__modal-overlay" onClick={()=>setEditingTemplate(null)}><div className="admin__modal admin__modal--wide" onClick={event=>event.stopPropagation()}>
      <h3 className="admin__modal-title">{editingTemplate.id?'Редактировать сценарий':'Новый сценарий'}</h3>
      <div className="admin__modal-field"><label className="admin__modal-label">Название</label><input className="admin__modal-input" value={editingTemplate.title} onChange={event=>setEditingTemplate({...editingTemplate,title:event.target.value})}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Slug</label><input className="admin__modal-input" value={editingTemplate.slug} disabled={Boolean(editingTemplate.id)} onChange={event=>setEditingTemplate({...editingTemplate,slug:event.target.value})}/></div>
      <div className="admin__row"><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Категория</label><select className="admin__select" value={editingTemplate.category} onChange={event=>setEditingTemplate({...editingTemplate,category:event.target.value})}><option value="text">Текст</option><option value="document">Документы</option><option value="image">Изображения</option><option value="video">Видео</option></select></div><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Тип задачи</label><input className="admin__modal-input" value={editingTemplate.task_type} onChange={event=>setEditingTemplate({...editingTemplate,task_type:event.target.value})}/></div></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Описание</label><textarea className="admin__modal-input" rows={2} value={editingTemplate.description} onChange={event=>setEditingTemplate({...editingTemplate,description:event.target.value})}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Промпт (используйте {'{input}'})</label><textarea className="admin__modal-input" rows={6} value={editingTemplate.prompt_template} onChange={event=>setEditingTemplate({...editingTemplate,prompt_template:event.target.value})}/></div>
      <div className="admin__row"><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Основная модель</label><select className="admin__select admin__model-select" aria-label="Основная модель сценария" value={editingTemplate.preferred_model||''} onChange={event=>setEditingTemplate({...editingTemplate,preferred_model:event.target.value})}>{modelOptions(editingTemplate)}</select><div className="admin__field-hint">Автовыбор учитывает тип задачи, доступность, приоритет и стоимость.</div></div><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Fallback-модели</label><input className="admin__modal-input" value={(editingTemplate.fallback_models||[]).join(', ')} onChange={event=>setEditingTemplate({...editingTemplate,fallback_models:event.target.value.split(',').map(value=>value.trim()).filter(Boolean)})} placeholder="provider/model-a, provider/model-b"/><div className="admin__field-hint">Используются по порядку, если основная модель недоступна.</div></div></div>
      <div className="admin__row"><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Что требуется</label><input className="admin__modal-input" value={editingTemplate.required_input} onChange={event=>setEditingTemplate({...editingTemplate,required_input:event.target.value})}/></div><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Оценка стоимости</label><input className="admin__modal-input" value={editingTemplate.estimated_credits_label} onChange={event=>setEditingTemplate({...editingTemplate,estimated_credits_label:event.target.value})}/></div></div>
      <div className="admin__row"><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Пример запроса</label><textarea className="admin__modal-input" rows={2} value={editingTemplate.example_input} onChange={event=>setEditingTemplate({...editingTemplate,example_input:event.target.value})}/></div><div className="admin__modal-field" style={{flex:1}}><label className="admin__modal-label">Пример результата</label><textarea className="admin__modal-input" rows={2} value={editingTemplate.example_output} onChange={event=>setEditingTemplate({...editingTemplate,example_output:event.target.value})}/></div></div>
      <div className="admin__modal-actions"><button className="admin__btn" onClick={()=>setEditingTemplate(null)}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={async()=>{try{if(editingTemplate.id)await saveTemplate(editingTemplate,editingTemplate);else await api('/task-templates',{method:'POST',body:JSON.stringify(editingTemplate)});setEditingTemplate(null);await load()}catch(e:any){setError(e.message)}}}>Сохранить</button></div>
    </div></div>}

    <h3 style={{margin:'28px 0 12px'}}>Приоритет автоматического выбора моделей</h3>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Модель</th><th>Статус</th><th>Ошибки</th><th>Приоритет</th></tr></thead><tbody>
      {models.filter(model=>model.is_visible).map(model=><tr key={model.id}><td><strong>{model.name}</strong><div style={{fontSize:11,color:'#8e8e9a'}}>{model.or_model_id}</div></td><td>{model.availability_status||'unknown'}{model.catalog_miss_count?` · пропусков ${model.catalog_miss_count}`:''}</td><td title={model.last_provider_error||''}>{model.error_count}</td><td><input className="admin__modal-input" style={{width:90}} type="number" defaultValue={model.recommended_priority||100} onBlur={async event=>{await api(`/models/${model.id}?recommended_priority=${Number(event.target.value)}`,{method:'PATCH'});}}/></td></tr>)}
    </tbody></table></div>
  </div>;
}

function GrowthOverviewSection({onNavigate}:{onNavigate:(section:Section)=>void}) {
  const [days,setDays]=useState(30); const [source,setSource]=useState(''); const [device,setDevice]=useState('');
  const [data,setData]=useState<any>(null); const [funnel,setFunnel]=useState<any>(null); const [error,setError]=useState('');
  useEffect(()=>{setError('');Promise.all([
    api<any>(`/growth/overview?days=${days}&source=${encodeURIComponent(source)}&device=${encodeURIComponent(device)}`),
    api<any>(`/growth/funnel?days=${days}&source=${encodeURIComponent(source)}&device=${encodeURIComponent(device)}`),
  ]).then(([overview,steps])=>{setData(overview);setFunnel(steps)}).catch(e=>setError(e.message))},[days,source,device]);
  if(error)return <div className="admin__error">{error}</div>;
  if(!data)return <div className="admin__loading">Собираем продуктовый обзор…</div>;
  const m=data.metrics||{};
  const cards=[
    ['Уникальные посетители',m.unique_visitors],['Регистрации',m.registrations],['Активация за 24 часа',`${m.activation_24h_pct}%`],
    ['Медиана до результата',m.median_time_to_value_seconds==null?'—':`${Math.round(m.median_time_to_value_seconds/60)} мин`],
    ['Успешные задачи',m.successful_tasks],['Ошибки генерации',`${m.task_failure_pct}%`],['DAU / WAU / MAU',`${m.dau} / ${m.wau} / ${m.mau}`],
    ['Платящие пользователи',m.paying_users],['Выручка',`${Number(m.revenue_rub||0).toLocaleString('ru-RU')} ₽`],
    ['Расходы моделей, оценка',`${Number(m.model_cost_rub_estimate||0).toLocaleString('ru-RU')} ₽`],['Валовая маржа, оценка',`${m.gross_margin_pct_estimate}%`],
    ['Первая / повторная оплата',`${m.first_payment_users} / ${m.repeat_payment_users}`],['Retention D1 / D7 / D30',`${m.retention_d1_pct}% / ${m.retention_d7_pct}% / ${m.retention_d30_pct}%`],
  ];
  return <div>
    <div className="admin__filters"><select className="admin__select" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={1}>Сегодня</option><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select><input className="admin__search-input" placeholder="Источник" value={source} onChange={e=>setSource(e.target.value)}/><select className="admin__select" value={device} onChange={e=>setDevice(e.target.value)}><option value="">Все устройства</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></div>
    <div className={`growth-freshness${data.sample_warning?' growth-freshness--warning':''}`}>Данные на {data.freshness?new Date(data.freshness).toLocaleString('ru-RU'):'—'} · выборка {data.sample_size} {data.sample_warning&&'· данных пока недостаточно для устойчивых выводов'}</div>
    <div className="admin__stats growth-stats">{cards.map(([label,value])=><button key={String(label)} className="admin__stat-card growth-stat-card" onClick={()=>onNavigate(label==='Ошибки генерации'?'blockers':label==='Платящие пользователи'||label==='Выручка'?'payments':'users')}><div className="admin__stat-label">{label}</div><div className="admin__stat-value">{value}</div></button>)}</div>
    <h3>Что требует внимания сегодня</h3>
    <div className="growth-alerts">{data.alerts?.length?data.alerts.map((item:any,index:number)=><button key={index} className={`growth-alert growth-alert--${item.severity}`} onClick={()=>onNavigate(item.target?.startsWith('blockers')?'blockers':'feedback')}><span>{item.title}</span><b>{item.value}</b></button>):<div className="admin__empty">Критичных отклонений не обнаружено.</div>}</div>
    <h3>Последовательная воронка · окно 7 дней</h3>
    <div className="growth-funnel">{funnel?.stages?.map((item:any,index:number)=><div key={item.event}><span>{index+1}. {item.stage}</span><b>{item.users}</b><small>{item.conversion_pct}% от прошлого шага · ушли {item.dropped}</small></div>)}</div>
  </div>;
}

function GrowthBlockersSection() {
  const [days,setDays]=useState(30); const [items,setItems]=useState<any[]>([]); const [selected,setSelected]=useState<any|null>(null); const [users,setUsers]=useState<any[]>([]); const [error,setError]=useState('');
  const load=useCallback(()=>api<any[]>(`/growth/blockers?days=${days}`).then(setItems).catch(e=>setError(e.message)),[days]);
  useEffect(()=>{void load()},[load]);
  const open=async(item:any)=>{setSelected(item);setError('');try{setUsers(await api<any[]>(`/growth/blockers/${item.code}/users?days=${days}`))}catch(e:any){setError(e.message)}};
  return <div>{error&&<div className="admin__error">{error}</div>}<div className="admin__filters"><select className="admin__select" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select></div>
    <div className="growth-blockers">{items.map(item=><button key={item.code} onClick={()=>void open(item)} className="growth-blocker"><span><strong>{item.label}</strong><small>{item.top_devices?.map((v:any)=>v[0]).join(', ')||'нет данных'} · {item.top_sources?.map((v:any)=>v[0]).join(', ')||'источник не определён'}</small></span><b>{item.users}</b><em>{item.share_pct}%</em>{item.revenue_at_risk_rub!=null&&<mark>{item.revenue_at_risk_rub} ₽ в начатых оплатах</mark>}</button>)}</div>
    {selected&&<div className="growth-panel"><div className="growth-panel__head"><h3>{selected.label}</h3><button className="admin__btn admin__btn--primary" disabled={!users.length} onClick={async()=>{await api('/growth/segments',{method:'POST',body:JSON.stringify({name:`${selected.label} · ${new Date().toLocaleDateString('ru-RU')}`,description:'Создано из отчёта препятствий',filters:{user_ids:users.map(user=>user.id)}})});alert('Сегмент создан')}}>Создать сегмент</button></div><div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Email</th><th>Баланс</th><th>Запросы</th><th>Последняя активность</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td>{user.id}</td><td>{user.email}</td><td>{user.credits}</td><td>{user.requests}</td><td>{user.last_seen?new Date(user.last_seen).toLocaleString('ru-RU'):'—'}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

function JourneySection() {
  const [userId,setUserId]=useState(''); const [data,setData]=useState<any>(null); const [filter,setFilter]=useState<'all'|'problems'|'payments'|'queries'>('all'); const [error,setError]=useState('');
  const load=async()=>{setError('');setData(null);try{setData(await api<any>(`/growth/journeys/${Number(userId)}`))}catch(e:any){setError(e.message)}};
  const timeline=(data?.timeline||[]).filter((item:any)=>filter==='all'||filter==='payments'?filter==='all'||['payment','credits'].includes(item.type):filter==='queries'?['query','response'].includes(item.type):item.type==='event'&&['generation_failed','payment_failed','auth_failed','balance_low'].includes(item.name));
  return <div><div className="admin__filters"><input className="admin__search-input" type="number" placeholder="ID пользователя" value={userId} onChange={e=>setUserId(e.target.value)}/><button className="admin__btn admin__btn--primary" disabled={!userId} onClick={()=>void load()}>Открыть путь</button></div>{error&&<div className="admin__error">{error}</div>}{data&&<><div className="growth-user-card"><div><strong>{data.user.email}</strong><small>#{data.user.id} · {data.user.name||'без имени'} · источник {data.user.source||'не определён'}</small></div><b>{data.user.credits} кредитов</b></div><div className="admin__tabs">{(['all','problems','payments','queries'] as const).map(value=><button key={value} className={`admin__tab${filter===value?' admin__tab--active':''}`} onClick={()=>setFilter(value)}>{{all:'Все',problems:'Только проблемы',payments:'Только оплаты',queries:'Запросы и ответы'}[value]}</button>)}</div><div className="growth-timeline">{timeline.map((item:any,index:number)=><article key={`${item.at}-${index}`} className={`growth-timeline__item growth-timeline__item--${item.type}`}><time>{new Date(item.at).toLocaleString('ru-RU')}</time><strong>{item.name}</strong><pre>{JSON.stringify(item.detail,null,2)}</pre></article>)}</div></>}</div>;
}

function GrowthCampaignsSection() {
  const [campaigns,setCampaigns]=useState<any[]>([]); const [segments,setSegments]=useState<any[]>([]); const [error,setError]=useState('');
  const [form,setForm]=useState<any>({name:'',title:'',body:'',placement:'notification',button_text:'Открыть',button_url:'/',segment_id:'',frequency_cap:1,holdout_pct:10,goal_event:'payment_succeeded'});
  const load=useCallback(()=>Promise.all([api<any[]>('/growth/campaigns'),api<any[]>('/growth/segments')]).then(([a,b])=>{setCampaigns(a);setSegments(b)}).catch(e=>setError(e.message)),[]); useEffect(()=>{void load()},[load]);
  const create=async()=>{setError('');try{await api('/growth/campaigns',{method:'POST',body:JSON.stringify({...form,segment_id:form.segment_id?Number(form.segment_id):null,audience:form.segment_id?{}:{include_anonymous:true}})});setForm({...form,name:'',title:'',body:''});await load()}catch(e:any){setError(e.message)}};
  return <div>{error&&<div className="admin__error">{error}</div>}<div className="growth-editor"><h3>Новая in‑app кампания</h3><div className="growth-editor__grid"><input className="admin__modal-input" placeholder="Служебное название" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><select className="admin__select" value={form.placement} onChange={e=>setForm({...form,placement:e.target.value})}><option value="notification">Центр сообщений</option><option value="banner">Баннер</option><option value="card">Карточка</option><option value="popup">Popup</option></select><input className="admin__modal-input" placeholder="Заголовок" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><select className="admin__select" value={form.segment_id} onChange={e=>setForm({...form,segment_id:e.target.value})}><option value="">Все, включая анонимных</option>{segments.map(item=><option key={item.id} value={item.id}>{item.name} · {item.size}</option>)}</select><textarea className="admin__modal-input" placeholder="Текст" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/><input className="admin__modal-input" placeholder="URL кнопки" value={form.button_url} onChange={e=>setForm({...form,button_url:e.target.value})}/></div><p className="growth-editor__hint">Контрольная группа 10%, лимит 1 показ. Кампания появится как черновик и потребует ручного запуска.</p><button className="admin__btn admin__btn--primary" disabled={!form.name||!form.title||!form.body} onClick={()=>void create()}>Создать черновик</button></div>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Кампания</th><th>Канал</th><th>Статус</th><th>Доставки</th><th>Результат</th><th>Действия</th></tr></thead><tbody>{campaigns.map(item=><tr key={item.id}><td><strong>{item.name}</strong><div>{item.title}</div></td><td>{item.placement}</td><td>{item.status}</td><td>{item.stats?.shown||0} показов · {item.stats?.clicked||0} кликов</td><td>{item.stats?.converted||0} конверсий · holdout {item.stats?.holdout||0}</td><td>{item.status!=='active'?<button className="admin__btn admin__btn--primary" onClick={async()=>{await api(`/growth/campaigns/${item.id}/activate`,{method:'POST'});await load()}}>Запустить</button>:<button className="admin__btn" onClick={async()=>{await api(`/growth/campaigns/${item.id}/pause`,{method:'POST'});await load()}}>Пауза</button>}</td></tr>)}</tbody></table></div>
  </div>;
}

function GamificationSection() {
  const [items,setItems]=useState<any[]>([]); const [error,setError]=useState(''); const load=useCallback(()=>api<any[]>('/growth/missions').then(setItems).catch(e=>setError(e.message)),[]); useEffect(()=>{void load()},[load]);
  const save=async(item:any,changes:any)=>{const next={...item,...changes};await api(`/growth/missions/${item.id}`,{method:'PUT',body:JSON.stringify({title:next.title,description:next.description,criteria:next.criteria,reward_credits:Number(next.reward_credits),reward_xp:Number(next.reward_xp),period:next.period,is_active:Boolean(next.is_active),sort_order:Number(next.sort_order)})});setItems(current=>current.map(value=>value.id===item.id?next:value))};
  return <div>{error&&<div className="admin__error">{error}</div>}<div className="growth-rules"><b>Правила экономики</b><span>5 XP за результат · до 25 XP/день · 20 бонусных кредитов/месяц · кредиты не сгорают</span><span>Уровни: Новичок 0 → Исследователь 100 → Практик 300 → Эксперт 700 → Мастер 1500</span></div><div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Миссия</th><th>Участие</th><th>Завершили</th><th>Стоимость</th><th>Награда</th><th>Активна</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.title}</strong><div>{item.description}</div></td><td>{item.started}</td><td>{item.completed} · {item.completion_pct}%</td><td>{item.credits_awarded} кр.</td><td><input className="admin__modal-input" style={{width:70}} type="number" defaultValue={item.reward_credits} onBlur={e=>void save(item,{reward_credits:Number(e.target.value)})}/> кр.</td><td><label className="admin__toggle"><input type="checkbox" checked={item.is_active} onChange={e=>void save(item,{is_active:e.target.checked})}/><span className="admin__toggle-slider"/></label></td></tr>)}</tbody></table></div></div>;
}

function GrowthSurveysSection() {
  const [items,setItems]=useState<any[]>([]); const [error,setError]=useState(''); useEffect(()=>{api<any[]>('/growth/surveys').then(setItems).catch(e=>setError(e.message))},[]);
  return <div>{error&&<div className="admin__error">{error}</div>}<div className="growth-surveys">{items.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>Триггер: {item.trigger_event} · не чаще 1 раза в {item.frequency_days} дней</small></div><b>{item.responses} ответов</b><div>{item.answers.map((answer:any)=><span key={answer[0]}>{answer[0]} — {answer[1]}</span>)}</div></article>)}</div></div>;
}

function ExperimentsSection() {
  const [items,setItems]=useState<any[]>([]); const [error,setError]=useState(''); const [name,setName]=useState(''); const [surface,setSurface]=useState('pricing');
  const load=useCallback(()=>api<any[]>('/growth/experiments').then(setItems).catch(e=>setError(e.message)),[]);useEffect(()=>{void load()},[load]);
  const create=async()=>{await api('/growth/experiments',{method:'POST',body:JSON.stringify({name,surface,primary_metric:surface==='pricing'?'payment':'activation',guardrails:['errors','costs','negative_feedback'],variants:[{key:'A',name:'Контроль',payload:{},weight:.5},{key:'B',name:'Вариант',payload:surface==='pricing'?{headline:'Выберите подходящий пакет',cta_text:'Получить кредиты'}:{featured_order:[]},weight:.5}]})});setName('');await load()};
  return <div>{error&&<div className="admin__error">{error}</div>}<div className="growth-editor"><h3>Новый эксперимент</h3><div className="growth-editor__grid"><input className="admin__modal-input" placeholder="Название" value={name} onChange={e=>setName(e.target.value)}/><select className="admin__select" value={surface} onChange={e=>setSurface(e.target.value)}><option value="pricing">Тарифы</option><option value="task_hub">Порядок сценариев</option></select></div><p className="growth-editor__hint">Варианты фиксируются после запуска. Решение доступно при 200 экспозициях и 20 конверсиях на вариант; победитель выбирается вручную.</p><button className="admin__btn admin__btn--primary" disabled={name.length<2} onClick={()=>void create()}>Создать A/B‑черновик</button></div>{items.map(item=><section key={item.id} className="growth-experiment"><div className="growth-panel__head"><div><h3>{item.name}</h3><small>{item.surface} · цель {item.primary_metric} · {item.status}</small></div>{item.status==='draft'?<button className="admin__btn admin__btn--primary" onClick={async()=>{await api(`/growth/experiments/${item.id}/start`,{method:'POST'});await load()}}>Запустить</button>:item.status==='active'&&<button className="admin__btn" onClick={async()=>{await api(`/growth/experiments/${item.id}/stop`,{method:'POST'});await load()}}>Остановить</button>}</div><div className="growth-experiment__variants">{item.variants.map((variant:any)=><article key={variant.id}><strong>{variant.name}</strong><b>{variant.conversion_pct}%</b><span>{variant.exposed} экспозиций · {variant.conversions} конверсий</span><small>{variant.enough_data?'Данных достаточно':'Рано делать выводы'}</small>{item.status==='active'&&variant.enough_data&&<button className="admin__btn" onClick={async()=>{await api(`/growth/experiments/${item.id}/winner?winner_variant_id=${variant.id}`,{method:'POST'});await load()}}>Выбрать победителем</button>}</article>)}</div></section>)}</div>;
}

function LoginForm({onLogin}:{onLogin:()=>void}) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  const handle=async(e:React.FormEvent)=>{e.preventDefault();setError('');setLoading(true);try{
    const d=await loginAdmin(email,password);if(!d.user?.is_admin){await logoutUser();throw new Error('У пользователя нет прав администратора')}onLogin();
  }catch(err:any){setError(err.message||'Ошибка входа')}finally{setLoading(false)}};
  return (
    <div className="admin"><div className="admin__login-form">
      <h2 style={{marginBottom:24,textAlign:'center'}}>Вход в панель управления</h2>
      <form onSubmit={handle}>
        <div className="admin__modal-field"><label className="admin__modal-label">Email</label><input className="admin__modal-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" autoFocus /></div>
        <div className="admin__modal-field"><label className="admin__modal-label">Пароль</label><input className="admin__modal-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></div>
        {error&&<div className="admin__error" style={{marginBottom:12}}>{error}</div>}
        <button className="admin__btn admin__btn--primary" type="submit" disabled={loading||!email||!password} style={{width:'100%',padding:12,fontSize:16}}>{loading?'Проверка...':'Войти'}</button>
      </form>
    </div></div>
  );
}

// ── Layout with Sidebar ──

function AdminLayout({section,onSection}:{section:Section;onSection:(s:Section)=>void}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(()=>{
    if(!mobileOpen)return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobileOpen(false)};
    window.addEventListener('keydown',closeOnEscape);
    return()=>window.removeEventListener('keydown',closeOnEscape);
  },[mobileOpen]);
  const leaveAdmin = async () => { try { await logoutUser(); } finally { window.location.reload(); } };
  const sectionTitle: Record<Section,string> = {
    'growth-overview':'Обзор проекта','blockers':'Что мешает пользователям','journeys':'Путь пользователя',
    campaigns:'Кампании',gamification:'Освоение AI‑Sphere',experiments:'A/B‑тесты','growth-surveys':'Микроопросы',
    workspace:'Сценарии и состояние сервисов',
    dashboard:'Дашборд',users:'Пользователи',models:'Модели',plans:'Тарифы',payments:'Платежи',
    credits:'Операции с кредитами',logs:'Журнал действий',errors:'Системные ошибки',promo:'Промокоды',
    roles:'Роли и доступ',chats:'Чаты',queries:'Запросы пользователей',files:'Файлы',tickets:'Поддержка',notifications:'Уведомления',
    fraud:'Антифрод',analytics:'Аналитика',
    seo:'SEO-страницы',referrals:'Партнёрская программа',
    forecast:'Прогнозирование',cohorts:'Когортный анализ',ltv:'LTV и Retention',
    feedback:'Обратная связь',
    'model-feedback':'Оценки ответов',
    metrica:'Яндекс Метрика',
    funnel:'Воронка',segments:'Сегменты',abandoned:'Брошенные оплаты',
    'model-analytics':'Аналитика моделей',problems:'Проблемы',
    surveys:'Результаты опросов',triggers:'Триггеры продаж',categories:'Категории запросов',
  };
  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="admin-layout">
      {mobileOpen && <div className="admin-sidebar__overlay" onClick={closeMobile} aria-hidden="true" />}
      <nav id="admin-navigation" aria-label="Разделы админки" className={`admin-sidebar${mobileOpen?' admin-sidebar--open':''}`}>
        <button type="button" className="admin-sidebar__close" onClick={closeMobile} aria-label="Закрыть меню">✕</button>
        <div className="admin-sidebar__logo"><span className="admin-sidebar__logo-icon">◆</span> AI-Sphere Admin</div>
        {navSections.map(s=><div key={s.title} className="admin-sidebar__section">
          <div className="admin-sidebar__section-title">{s.title}</div>
          {s.items.map(i=>
            <button key={i.id} className={`admin-sidebar__item${section===i.id?' admin-sidebar__item--active':''}`} onClick={()=>{onSection(i.id);closeMobile()}}>
              <span className="admin-sidebar__icon">{i.icon}</span> {i.label}
            </button>
          )}
        </div>)}
        <div className="admin-sidebar__bottom">
          <button className="admin-sidebar__item" onClick={leaveAdmin}><span className="admin-sidebar__icon">🚪</span> Выйти</button>
        </div>
      </nav>
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar__left">
            <button type="button" className="admin-sidebar__hamburger" onClick={()=>setMobileOpen(true)} aria-label="Меню" aria-expanded={mobileOpen} aria-controls="admin-navigation">
              <span/><span/><span/>
            </button>
            <h2 className="admin-topbar__title">{sectionTitle[section]}</h2>
          </div>
          <div className="admin-topbar__right"><span className="admin-topbar__user">admin</span><button className="admin-topbar__logout" onClick={leaveAdmin}>Выйти</button></div>
        </div>
        <div className="admin-content">
          {section==='growth-overview'&&<GrowthOverviewSection onNavigate={onSection} />}
          {section==='blockers'&&<GrowthBlockersSection />}
          {section==='journeys'&&<JourneySection />}
          {section==='campaigns'&&<GrowthCampaignsSection />}
          {section==='gamification'&&<GamificationSection />}
          {section==='experiments'&&<ExperimentsSection />}
          {section==='growth-surveys'&&<GrowthSurveysSection />}
          {section==='workspace'&&<WorkspaceAdminSection />}
          {section==='dashboard'&&<DashboardSection />}
          {section==='users'&&<UsersSection />}
          {section==='models'&&<ModelsSection />}
          {section==='plans'&&<PlansSection />}
          {section==='payments'&&<PaymentsSection />}
          {section==='credits'&&<CreditsSection />}
          {section==='logs'&&<LogsSection />}
          {section==='errors'&&<ErrorsSection />}
          {section==='promo'&&<PromoSection />}
          {section==='roles'&&<RolesSection />}
          {section==='chats'&&<ChatsSection />}
          {section==='queries'&&<QueriesSection />}
          {section==='files'&&<FilesSection />}
          {section==='tickets'&&<TicketsSection />}
          {section==='feedback'&&<FeedbacksSection />}
          {section==='model-feedback'&&<ModelFeedbackSection />}
          {section==='metrica'&&<MetricaSection />}
          {section==='notifications'&&<NotificationsSection />}
          {section==='fraud'&&<FraudSection />}
          {section==='analytics'&&<AnalyticsSection />}
          {section==='funnel'&&<FunnelSection />}
          {section==='problems'&&<ProblemsSection />}
          {section==='segments'&&<SegmentsSection />}
          {section==='categories'&&<CategoriesSection />}
          {section==='model-analytics'&&<ModelAnalyticsSection />}
          {section==='abandoned'&&<AbandonedSection />}
          {section==='surveys'&&<SurveysSection />}
          {section==='triggers'&&<TriggersSection />}
          {section==='seo'&&<SeoSection />}
          {section==='referrals'&&<ReferralsSection />}
          {section==='forecast'&&<ForecastSection />}
          {section==='cohorts'&&<CohortsSection />}
          {section==='ltv'&&<LtvSection />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════
// Dashboard
// ══════════════════════════════════

function DashboardSection() {
  const [stats,setStats]=useState<Stats|null>(null); const [warnings,setWarnings]=useState<Warning[]>([]); const [period,setPeriod]=useState('today'); const [err,setErr]=useState('');
  useEffect(()=>{
    api<Stats>(`/dashboard/stats?period=${period}`).then(setStats).catch(e=>setErr(e.message));
    api<{warnings:Warning[]}>('/dashboard/warnings').then(d=>setWarnings(d.warnings)).catch(()=>{});
  },[period]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!stats)return<div className="admin__loading">Загрузка...</div>;
  const cards=[
    {l:'Выручка',v:`${stats.revenue.toLocaleString('ru-RU')} ₽`,g:stats.revenue_growth,c:'rub'},
    {l:'Расходы OR',v:`${stats.or_cost}`,g:0,c:''},
    {l:'Регистрации',v:stats.registrations,g:0,c:'users'},
    {l:'Всего пользователей',v:stats.total_users,g:0,c:'users'},
    {l:'Активны сейчас',v:stats.active_now,g:0,c:'active'},
    {l:'Платящие',v:stats.paying_users,g:0,c:''},
    {l:'Запросы',v:stats.requests,g:0,c:''},
    {l:'Ошибки',v:stats.errors,g:0,c:''},
  ];
  return <>
    <div className="admin__row" style={{marginBottom:16}}>
      <span style={{fontSize:13,color:'var(--text-secondary)'}}>Период:</span>
      <select className="admin__select" value={period} onChange={e=>setPeriod(e.target.value)}>
        <option value="today">Сегодня</option><option value="yesterday">Вчера</option>
        <option value="7d">7 дней</option><option value="30d">30 дней</option><option value="month">Месяц</option>
      </select>
    </div>
    {warnings.length>0&&<div className="admin__warnings">{warnings.map((w,i)=><div key={i} className={`admin__warning admin__warning--${w.severity==='critical'?'critical':'info'}`}>{w.message}</div>)}</div>}
    <div className="admin__stats">{cards.map((c,i)=><div key={i} className="admin__stat-card"><div className="admin__stat-label">{c.l}</div><div className={`admin__stat-value${c.c?' admin__stat-value--'+c.c:''}`}>{c.v}</div>{c.g!==0&&<div className={`admin__growth ${c.g>=0?'admin__growth--up':'admin__growth--down'}`}>{c.g>=0?'+':''}{c.g}%</div>}</div>)}</div>
  </>;
}

// ══════════════════════════════════
// Users (unchanged)
// ══════════════════════════════════

function UsersSection() {
  const [users,setUsers]=useState<UserItem[]>([]); const [total,setTotal]=useState(0); const [search,setSearch]=useState(''); const [offset,setOffset]=useState(0); const [loading,setLoading]=useState(true); const [err,setErr]=useState(''); const [creditModal,setCreditModal]=useState<UserItem|null>(null); const [userCard,setUserCard]=useState<number|null>(null);
  const fetchUsers=useCallback(async(q:string,off:number)=>{setLoading(true);setErr('');try{
    const p=new URLSearchParams({limit:'50',offset:String(off)});if(q)p.set('search',q);
    const d=await api<{total:number;users:UserItem[]}>(`/users?${p}`);setUsers(d.users);setTotal(d.total);
  }catch(e:any){setErr(e.message)}finally{setLoading(false)}},[],);
  useEffect(()=>{fetchUsers(search,offset)},[search,offset,fetchUsers]);
  const handleBlock=async(id:number)=>{if(!confirm('Заблокировать?'))return;try{await api(`/users/${id}/toggle-block`,{method:'POST'});fetchUsers(search,offset)}catch(e:any){setErr(e.message)}};
  const handleDelete=async(id:number,email:string)=>{if(!confirm(`Удалить пользователя ${email}? Это удалит все его чаты, платежи и историю.`))return;try{await api(`/users/${id}`,{method:'DELETE'});fetchUsers(search,offset)}catch(e:any){setErr(e.message)}};
  if(userCard)return<UserCard userId={userCard} onBack={()=>setUserCard(null)} />;
  const totalPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    <div className="admin__search"><input className="admin__search-input" placeholder="Поиск по email или имени..." value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}}/><span className="admin__page-info">Всего: {total}</span></div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:users.length===0?<div className="admin__empty">Пользователи не найдены</div>:
    <><div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Email</th><th>Кредиты</th><th>Платные</th><th>Беспл.</th><th>Статус</th><th>Запросов</th><th>Последний визит</th><th></th></tr></thead><tbody>
      {users.map(u=><tr key={u.id}><td>{u.id}</td><td><a href="#" onClick={e=>{e.preventDefault();setUserCard(u.id)}} style={{color:'var(--accent)'}}>{u.email}</a></td><td>{u.credits}</td><td>{u.credits_paid}</td><td>{u.credits_free}</td>
        <td>{u.is_admin&&<span className="admin__badge admin__badge--admin">admin</span>}{!u.is_active&&<span className="admin__badge admin__badge--blocked">blocked</span>}{!u.is_admin&&u.is_active&&<span className="admin__badge admin__badge--active">active</span>}</td>
        <td>{u.request_count}</td><td style={{fontSize:12,color:'#8e8e9a'}}>{u.last_seen?new Date(u.last_seen).toLocaleString('ru-RU'):'никогда'}</td>
        <td><div className="admin__row"><button className="admin__btn admin__btn-sm admin__btn--success" onClick={()=>setCreditModal(u)}>+credits</button><button className={`admin__btn admin__btn-sm ${u.is_active?'admin__btn--danger':''}`} onClick={()=>handleBlock(u.id)}>{u.is_active?'block':'unblock'}</button><button className="admin__btn admin__btn-sm admin__btn--danger" onClick={()=>handleDelete(u.id,u.email)}>🗑️</button></div></td>
      </tr>)}
    </tbody></table></div>
    {totalPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totalPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
    </>}
    {creditModal&&<CreditModal user={creditModal} onClose={()=>setCreditModal(null)} onDone={()=>{setCreditModal(null);fetchUsers(search,offset)}} />}
  </div>;
}

function CreditModal({user,onClose,onDone}:{user:UserItem;onClose:()=>void;onDone:()=>void}) {
  const [amount,setAmount]=useState(''); const [reason,setReason]=useState(''); const [ctype,setCtype]=useState('paid'); const [loading,setLoading]=useState(false); const [err,setErr]=useState(''); const [success,setSuccess]=useState('');
  const handle=async()=>{const a=parseInt(amount);if(!a||a<=0){setErr('Введите положительное число');return}setLoading(true);setErr('');setSuccess('');try{
    await api(`/users/${user.id}/credits?op_type=manual_add&credit_type=${ctype}&amount=${a}&comment=${encodeURIComponent(reason)}`,{method:'POST'});
    setSuccess(`Добавлено ${a} ${ctype} кредитов`);setTimeout(onDone,1500);
  }catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Добавить кредиты</h3><p style={{fontSize:13,color:'#8e8e9a',marginBottom:16}}>Пользователь: <strong>{user.email}</strong> (баланс: {user.credits})</p>
    <div className="admin__modal-field"><label className="admin__modal-label">Тип</label><select className="admin__select" value={ctype} onChange={e=>setCtype(e.target.value)} style={{width:'100%'}}><option value="paid">Платные</option><option value="free">Бесплатные</option><option value="bonus">Бонусные</option><option value="promo">Промо</option></select></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Количество</label><input className="admin__modal-input" type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="100"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Причина</label><input className="admin__modal-input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Бонус"/></div>
    {err&&<div className="admin__error">{err}</div>}{success&&<div className="admin__success">{success}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading}>{loading?'...':'Добавить'}</button></div>
  </div></div>;
}

function UserCard({userId,onBack}:{userId:number;onBack:()=>void}) {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
  useEffect(()=>{api<any>(`/users/${userId}`).then(setData).catch(e=>setErr(e.message))},[userId]);
  if(err)return<div className="admin__error">{err}</div>;if(!data)return<div className="admin__loading">Загрузка...</div>;
  const u=data.user;
  return <div>
    <button className="admin__back-btn" onClick={onBack}>← Назад к списку</button>
    <h3 style={{margin:'16px 0'}}>{u.email}</h3>
    <div className="admin__stats" style={{marginBottom:24}}>
      <div className="admin__stat-card"><div className="admin__stat-label">Платные</div><div className="admin__stat-value">{u.credits_paid}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Бесплатные</div><div className="admin__stat-value">{u.credits_free}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Бонус</div><div className="admin__stat-value">{u.credits_bonus}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Потрачено</div><div className="admin__stat-value" style={{color:'#00b894'}}>{u.total_spent_rub} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Запросов</div><div className="admin__stat-value">{u.request_count}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Регистрация</div><div className="admin__stat-value" style={{fontSize:16}}>{new Date(u.created_at).toLocaleDateString('ru-RU')}</div></div>
    </div>
    <h4 style={{margin:'16px 0 8px',fontSize:14,color:'var(--text-secondary)'}}>Платежи</h4>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Сумма</th><th>Кредиты</th><th>Дата</th></tr></thead><tbody>
      {data.payments?.length?data.payments.map((p:any)=><tr key={p.id}><td>{p.id}</td><td>{p.rub_amount} ₽</td><td>+{p.amount}</td><td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(p.created_at).toLocaleString('ru-RU')}</td></tr>):<tr><td colSpan={4} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет платежей</td></tr>}
    </tbody></table></div>
    <h4 style={{margin:'16px 0 8px',fontSize:14,color:'var(--text-secondary)'}}>Операции с кредитами</h4>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Тип</th><th>Кредиты</th><th>До/После</th><th>Комментарий</th><th>Дата</th></tr></thead><tbody>
      {data.credit_ops?.length?data.credit_ops.map((o:any)=><tr key={o.id}><td><span className={`admin__badge ${o.amount>0?'admin__badge--active':'admin__badge--blocked'}`}>{o.op_type}</span></td><td style={{color:o.amount>0?'#00b894':'#e74c3c'}}>{o.amount>0?'+':''}{o.amount}</td><td>{o.balance_before}→{o.balance_after}</td><td style={{fontSize:12}}>{o.comment}</td><td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(o.created_at).toLocaleString('ru-RU')}</td></tr>):<tr><td colSpan={5} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет операций</td></tr>}
    </tbody></table></div>
  </div>;
}

// ══════════════════════════════════
// Metrica (Yandex Metrica)
// ══════════════════════════════════

function MetricaSection() {
  const [counterId, setCounterId] = useState('');
  const [savedId, setSavedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<{counter_id: string}>('/metrica').then(d => {
      setCounterId(d.counter_id || '');
      setSavedId(d.counter_id || '');
    }).catch(e => setErr(e.message));
  }, []);

  const save = async () => {
    setLoading(true); setErr(''); setMsg('');
    try {
      const d = await api<{counter_id: string}>(`/metrica?counter_id=${encodeURIComponent(counterId)}`, {method:'PUT'});
      setSavedId(d.counter_id || '');
      setMsg('Сохранено!');
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  };

  return <div>
    <div style={{maxWidth:600}}>
      <p style={{fontSize:13,color:'#8e8e9a',marginBottom:8}}>
        Введите ID счётчика Яндекс.Метрики. Код метрики будет вставлен на все страницы сайта 
        асинхронно, без замедления загрузки.
      </p>
      <div className="admin__modal-field">
        <label className="admin__modal-label">ID счётчика</label>
        <input className="admin__modal-input" type="text" value={counterId}
          onChange={e => setCounterId(e.target.value)}
          placeholder="например: 98765432" />
      </div>
      {err && <div className="admin__error">{err}</div>}
      {msg && <div className="admin__success">{msg}</div>}
      <div style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
        <button className="admin__btn admin__btn--primary" onClick={save} disabled={loading}>
          {loading ? 'Сохранение...' : (savedId ? 'Обновить' : 'Сохранить')}
        </button>
        {savedId && <span style={{fontSize:12,color:'#00b894'}}>✅ активен: {savedId}</span>}
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════
//
// ══════════════════════════════════

function ModelRow({model,onUpdate,onRecalc}:{model:ModelItem;onUpdate:(id:number,f:string,v:any)=>Promise<void>;onRecalc:(id:number)=>Promise<void>}) {
  const [inputVal,setInputVal]=useState(String(model.price_input??''));
  const [outputVal,setOutputVal]=useState(String(model.price_output??''));
  useEffect(()=>{setInputVal(String(model.price_input??''));setOutputVal(String(model.price_output??''))},[model.id,model.price_input,model.price_output]);
  const margin=model.margin??0;
  const requiredMargin=(model.margin_min||0.8)*100;
  const iu=margin<requiredMargin;
  const isText=(model.output_modalities||[]).includes('text');
  const savePrice=(field:'price_input'|'price_output',value:string,current:number)=>{const next=parseFloat(value);if(!isNaN(next)&&next>=0&&next!==current)onUpdate(model.id,field,String(next))};
  return <tr style={iu?{background:'rgba(231,76,60,0.05)'}:{}}>
    <td><strong>{model.name}</strong><br/><span style={{fontSize:11,color:'#8e8e9a'}}>{model.or_model_id}</span></td>
    <td>{model.provider}</td><td>{model.category}</td>
    <td style={{fontSize:11,whiteSpace:'nowrap'}}>{isText?<><div>In: <strong>${Number(model.or_input_cost||0).toFixed(3)}</strong>/1M</div><div>Out: <strong>${Number(model.or_output_cost||0).toFixed(3)}</strong>/1M</div></>:model.provider_cost_usd_unit!=null?<><strong>${Number(model.provider_cost_usd_unit).toFixed(5)}</strong><div style={{color:'#8e8e9a'}}>{model.unit_basis}</div></>:'—'}</td>
    <td style={{fontSize:11,whiteSpace:'nowrap'}}>{model.provider_cost_usd_unit!=null?<><div><strong>${Number(model.provider_cost_usd_unit).toFixed(6)}</strong></div><div><strong>{Number(model.provider_cost_rub_unit||0).toFixed(5)} ₽</strong></div><div style={{color:'#8e8e9a'}}>{model.unit_basis}</div></>:'—'}</td>
    <td style={{fontSize:11}}>{isText?<div style={{display:'grid',gap:4,minWidth:105}}><label style={{display:'flex',alignItems:'center',gap:4}}>In <input className="admin__modal-input" aria-label={`Input цена ${model.name}`} type="number" step="0.01" min="0" value={inputVal} onChange={e=>setInputVal(e.target.value)} onBlur={()=>savePrice('price_input',inputVal,model.price_input)} style={{width:72,padding:'4px 6px',fontSize:11}}/></label><label style={{display:'flex',alignItems:'center',gap:4}}>Out <input className="admin__modal-input" aria-label={`Output цена ${model.name}`} type="number" step="0.01" min="0" value={outputVal} onChange={e=>setOutputVal(e.target.value)} onBlur={()=>savePrice('price_output',outputVal,model.price_output)} style={{width:72,padding:'4px 6px',fontSize:11}}/></label><span style={{color:'#8e8e9a'}}>кредитов за 1K</span></div>:<><strong>{model.revenue_credits_unit}</strong> кр.<div style={{color:'#8e8e9a'}}>{model.unit_basis}</div></>}</td>
    <td style={{fontSize:11,whiteSpace:'nowrap'}}><strong>{Number(model.revenue_credits_unit||0).toFixed(2)} кр.</strong><div>{Number(model.revenue_rub_unit||0).toFixed(5)} ₽</div><div style={{color:'#8e8e9a'}}>{model.unit_basis}</div></td>
    <td style={{fontSize:11,whiteSpace:'nowrap'}}>{model.profit_rub_unit!=null?<><strong>{Number(model.profit_rub_unit).toFixed(5)} ₽</strong><div style={{color:'#8e8e9a'}}>после комиссий</div></>:'—'}</td>
    <td><span style={{color:iu?'#e74c3c':margin<80?'#fdcb6e':'#00b894',fontWeight:600}}>{margin}%</span></td>
    <td><div style={{display:'flex',flexWrap:'wrap',gap:4,maxWidth:180}}>{[
      ...(model.input_modalities||[]).map(value=>`in:${value}`),
      ...(model.output_modalities||[]).map(value=>`out:${value}`),
    ].map(tag=><span key={tag} className="admin__badge" style={{fontSize:10}}>{tag}</span>)}</div></td>
    <td><label className="admin__toggle" title="Разрешить автоматический выбор"><input type="checkbox" checked={model.auto_route_enabled} onChange={()=>onUpdate(model.id,'auto_route_enabled',model.auto_route_enabled?'false':'true')}/><span className="admin__toggle-slider"></span></label></td>
    <td><label className="admin__toggle"><input type="checkbox" checked={model.is_active} onChange={()=>onUpdate(model.id,'is_active',model.is_active?'false':'true')}/><span className="admin__toggle-slider"></span></label></td>
    <td style={{color:model.error_count>0?'#e74c3c':'#8e8e9a'}}>{model.error_count}</td>
    <td><button className="admin__btn admin__btn-sm" onClick={()=>onRecalc(model.id)}>⟳</button></td>
  </tr>;
}

function ModelsSection() {
  const [models,setModels]=useState<ModelItem[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [syncing,setSyncing]=useState(false); const [syncResult,setSyncResult]=useState('');
  const [economics,setEconomics]=useState<any>(null);
  const modelsAnchorRef=useRef<HTMLDivElement>(null);
  const modelsTableRef=useRef<HTMLDivElement>(null);
  const modelsTopScrollRef=useRef<HTMLDivElement>(null);
  const [modelsTableWidth,setModelsTableWidth]=useState(0);
  const [modelsTableOverflow,setModelsTableOverflow]=useState(false);
  const [showModelsTop,setShowModelsTop]=useState(false);
  const loadModels=useCallback(async()=>{setLoading(true);setErr('');try{const [nextModels,nextEconomics]=await Promise.all([api<ModelItem[]>('/models'),api<any>('/models/economics')]);setModels(nextModels);setEconomics(nextEconomics)}catch(e:any){setErr(e.message)}finally{setLoading(false)}},[]);
  const refreshModels=useCallback(async()=>{try{const [nextModels,nextEconomics]=await Promise.all([api<ModelItem[]>('/models'),api<any>('/models/economics')]);setModels(nextModels);setEconomics(nextEconomics)}catch(e:any){setErr(e.message)}},[]);
  useEffect(()=>{loadModels()},[loadModels]);
  useEffect(()=>{
    const table=modelsTableRef.current; const top=modelsTopScrollRef.current;
    if(!table||!top)return;
    let syncingScroll=false;
    const measure=()=>{setModelsTableWidth(table.scrollWidth);setModelsTableOverflow(table.scrollWidth>table.clientWidth+1)};
    const fromTop=()=>{if(syncingScroll)return;syncingScroll=true;table.scrollLeft=top.scrollLeft;requestAnimationFrame(()=>{syncingScroll=false})};
    const fromTable=()=>{if(syncingScroll)return;syncingScroll=true;top.scrollLeft=table.scrollLeft;requestAnimationFrame(()=>{syncingScroll=false})};
    measure();
    const observer=new ResizeObserver(measure);observer.observe(table);
    const tableElement=table.querySelector('table');if(tableElement)observer.observe(tableElement);
    top.addEventListener('scroll',fromTop,{passive:true});table.addEventListener('scroll',fromTable,{passive:true});
    return()=>{observer.disconnect();top.removeEventListener('scroll',fromTop);table.removeEventListener('scroll',fromTable)};
  },[models.length,loading]);
  useEffect(()=>{
    const anchor=modelsAnchorRef.current;if(!anchor)return;
    const root=anchor.closest('.admin-content');
    const observer=new IntersectionObserver(([entry])=>setShowModelsTop(
      !entry.isIntersecting&&entry.boundingClientRect.top<(entry.rootBounds?.top??0)
    ),{root,threshold:0});
    observer.observe(anchor);return()=>observer.disconnect();
  },[loading]);
  const updateModel=async(id:number,field:string,val:any)=>{try{await api(`/models/${id}?${field}=${encodeURIComponent(String(val))}`,{method:'PATCH'});await refreshModels()}catch(e:any){setErr(e.message)}};
  const syncOpenRouter=async()=>{setSyncing(true);setSyncResult('');try{const result=await api<{ok:boolean;error?:string;catalog_models:number;updated:number;imported:number;enabled:number;target_margin_pct:number;endpoint_errors:string[]}>('/models/auto-update-prices',{method:'POST'});setSyncResult(result.ok?`Каталог: ${result.catalog_models}, добавлено: ${result.imported}, доступно пользователям: ${result.enabled}, защита маржи: ${result.target_margin_pct}%${result.endpoint_errors?.length?`. Ошибки: ${result.endpoint_errors.join('; ')}`:''}`:`OpenRouter не обновлён: ${result.error||'неизвестная ошибка'}`);await refreshModels()}catch(e:any){setErr(e.message)}finally{setSyncing(false)}};
  if(err)return<div className="admin__error">{err}</div>;
  if(loading)return<div className="admin__loading">Загрузка...</div>;
  return <div><div className="admin__row" style={{marginBottom:12}}><button className="admin__btn admin__btn--primary" onClick={syncOpenRouter} disabled={syncing}>{syncing?'Синхронизация…':'Синхронизировать OpenRouter'}</button>{syncResult&&<span className="admin__page-info">{syncResult}</span>}</div>
  {economics&&<><div className="growth-rules"><b>Защита экономики: {economics.guard_passed?'работает':'есть риск'}</b><span>Минимальная маржа {economics.assumptions.target_margin_pct}% · контрольный тариф «{economics.assumptions.guard_plan_name}» · {economics.assumptions.cheapest_credit_rub} ₽/кредит</span><span>Курс {economics.assumptions.usd_rub_rate} ₽/$ × запас {economics.assumptions.fx_safety_factor} · комиссия оплаты {economics.assumptions.payment_fee_pct}% · пополнение OpenRouter {economics.assumptions.openrouter_funding_fee_pct}%</span></div>
  {economics.pnl&&<div className="growth-rules"><b>P&amp;L за {economics.pnl.period_days} дней: {economics.pnl.break_even?'безубыточно':'убыток'}</b><span>Выручка {economics.pnl.revenue_rub} ₽ · провайдер {economics.pnl.provider_cost_rub} ₽ · эквайринг {economics.pnl.payment_fees_rub} ₽ · постоянные расходы {economics.pnl.fixed_costs_rub} ₽</span><span>Бесплатная программа ${economics.pnl.free_program_cost_usd} · contribution {economics.pnl.contribution_rub} ₽</span></div>}
  <h3>Стоимость по пользовательским задачам</h3><div className="admin__table-wrapper" style={{marginBottom:24}}><table className="admin__table"><thead><tr><th>Задача</th><th>Модель</th><th>Профиль</th><th>Себестоимость</th><th>Списание</th><th>Цена для пользователя</th><th>Маржа</th></tr></thead><tbody>{economics.tasks.map((item:any)=><tr key={item.template_id}><td><strong>{item.task}</strong><div style={{fontSize:11,color:'#8e8e9a'}}>{item.task_type}</div></td><td>{item.model_name||'Нет доступной модели'}<div style={{fontSize:10,color:'#8e8e9a'}}>{item.model||''}</div></td><td style={{fontSize:11}}>{item.input_tokens?`${item.input_tokens} in / ${item.output_tokens} out`:Object.entries(item.parameters||{}).map(([key,value])=>`${key}: ${String(value)}`).join(' · ')}</td><td>${Number(item.provider_cost_usd||0).toFixed(4)}</td><td>{item.credits||0} кр.</td><td>{Number(item.customer_price_rub||0).toFixed(2)} ₽</td><td><strong style={{color:item.status==='safe'?'#00b894':'#e74c3c'}}>{item.margin_pct??'—'}%</strong></td></tr>)}</tbody></table></div>
  <h3>Фактическая экономика за {economics.actual_period_days} дней</h3><div className="admin__table-wrapper" style={{marginBottom:24}}><table className="admin__table"><thead><tr><th>Задача</th><th>Модель</th><th>Генерации</th><th>С данными стоимости</th><th>Пользователи</th><th>OpenRouter</th><th>Выручка в кредитах</th><th>Маржа</th></tr></thead><tbody>{(economics.actual||[]).length?(economics.actual||[]).map((item:any)=><tr key={`${item.task_type}:${item.model}`}><td>{item.task_type}</td><td>{item.model}</td><td>{item.generations}</td><td>{item.priced_generations}</td><td>{item.unique_users}</td><td>${Number(item.provider_cost_usd||0).toFixed(4)}</td><td>{item.credits} кр. · {Number(item.customer_price_rub||0).toFixed(2)} ₽</td><td><strong style={{color:item.margin_pct==null?'#8e8e9a':item.margin_pct>=economics.assumptions.target_margin_pct?'#00b894':'#e74c3c'}}>{item.margin_pct==null?'нет данных':`${item.margin_pct}%`}</strong></td></tr>):<tr><td colSpan={8}>Фактические данные появятся после новых успешных генераций.</td></tr>}</tbody></table></div></>}
  <div ref={modelsAnchorRef} className="admin__model-table-anchor" aria-hidden="true" />
  <div className="admin__model-table-head"><h3>Каталог моделей</h3><span>{models.length} моделей · таблицу можно двигать горизонтально</span></div>
  <div className={`admin__table-scroll-top${modelsTableOverflow?' admin__table-scroll-top--visible':''}`} ref={modelsTopScrollRef} aria-label="Горизонтальная прокрутка таблицы моделей"><div style={{width:modelsTableWidth}} /></div>
  <div className="admin__table-wrapper admin__model-table" ref={modelsTableRef}><table className="admin__table"><thead><tr><th>Название</th><th>Провайдер</th><th>Категория</th><th>OpenRouter<br/><span style={{fontSize:10,fontWeight:400,color:'#8e8e9a'}}>$ / 1M токенов</span></th><th>Себестоимость<br/><span style={{fontSize:10,fontWeight:400,color:'#8e8e9a'}}>USD и ₽</span></th><th>Списание<br/><span style={{fontSize:10,fontWeight:400,color:'#8e8e9a'}}>кредиты input/output</span></th><th>Выручка<br/><span style={{fontSize:10,fontWeight:400,color:'#8e8e9a'}}>кредиты и ₽</span></th><th>Прибыль<br/><span style={{fontSize:10,fontWeight:400,color:'#8e8e9a'}}>после комиссий</span></th><th>Маржа</th><th>Возможности</th><th>Авто</th><th>Статус</th><th>Ошибки</th><th></th></tr></thead><tbody>
    {models.map(m=><ModelRow key={m.id} model={m} onUpdate={updateModel} onRecalc={async id=>{try{await api(`/models/${id}/recalc`,{method:'POST'});await refreshModels()}catch(e:any){setErr(e.message)}}}/>)}
  </tbody></table></div>{showModelsTop&&<button type="button" className="admin__models-back-top" onClick={()=>modelsAnchorRef.current?.scrollIntoView({behavior:'smooth',block:'start'})} aria-label="К началу таблицы моделей">↑ <span>К началу моделей</span></button>}</div>;
}

// ══════════════════════════════════
// Plans (unchanged)
// ══════════════════════════════════

function PlansSection() {
  const [plans,setPlans]=useState<PlanItem[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState(''); const [showCreate,setShowCreate]=useState(false); const [editing,setEditing]=useState<PlanItem|null>(null);
  const fetch=useCallback(async()=>{setLoading(true);try{setPlans(await api<PlanItem[]>('/plans'))}catch(e:any){setErr(e.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{fetch()},[fetch]);
  const handleDelete = async (p: PlanItem) => {
    if (!confirm(`Удалить тариф «${p.name}»?`)) return;
    try { await api(`/plans/${p.id}`, {method:'DELETE'}); fetch(); } catch(e:any) { setErr(e.message); }
  };
  if(err)return<div className="admin__error">{err}</div>;
  return <div>
    <div className="admin__section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><span className="admin__page-info">Тарифов: {plans.length}</span><button className="admin__btn admin__btn--primary" onClick={()=>setShowCreate(true)}>+ Новый тариф</button></div>
    {loading?<div className="admin__loading">Загрузка...</div>:<div className="admin__stats">
      {plans.map(p=><div key={p.id} className="admin__stat-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><strong style={{fontSize:16}}>{p.name}</strong>{p.badge&&<span className="admin__badge admin__badge--promo">{p.badge}</span>}</div>
        <div style={{fontSize:24,fontWeight:700,color:'#00b894'}}>{(p.price_rub/100).toLocaleString('ru-RU')} ₽</div>
        <div style={{fontSize:13,color:'#8e8e9a',marginTop:4}}>{p.credits} кредитов{p.bonus_credits>0?` + ${p.bonus_credits}`:''}</div>
        <div style={{fontSize:12,color:'#8e8e9a'}}>Цена кредита: {p.credit_price.toFixed(4)} ₽</div>
        <div style={{fontSize:12,color:'#8e8e9a'}}>Продано: {p.purchase_count}</div>
        <div className="admin__row" style={{marginTop:12,gap:8}}>
          <button className="admin__btn admin__btn-sm" onClick={()=>setEditing(p)}>✏️ Редактировать</button>
          <button className="admin__btn admin__btn-sm admin__btn--danger" onClick={()=>handleDelete(p)}>🗑️ Удалить</button>
        </div>
      </div>)}
    </div>}
    {showCreate&&<CreatePlanModal onClose={()=>setShowCreate(false)} onDone={()=>{setShowCreate(false);fetch()}} />}
    {editing&&<EditPlanModal plan={editing} onClose={()=>setEditing(null)} onDone={()=>{setEditing(null);fetch()}} />}
  </div>;
}

function CreatePlanModal({onClose,onDone}:{onClose:()=>void;onDone:()=>void}) {
  const [name,setName]=useState(''); const [credits,setCredits]=useState('1000'); const [price,setPrice]=useState('50000'); const [bonus,setBonus]=useState('0'); const [loading,setLoading]=useState(false); const [err,setErr]=useState(''); const [success,setSuccess]=useState('');
  const handle=async()=>{setLoading(true);setErr('');try{await api('/plans',{method:'POST',body:JSON.stringify({name,credits:Number(credits),price_rub:Number(price),bonus_credits:Number(bonus)})});setSuccess('Создано!');setTimeout(onDone,1500)}catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Новый тариф</h3>
    <div className="admin__modal-field"><label className="admin__modal-label">Название</label><input className="admin__modal-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Премиум"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Цена (коп.)</label><input className="admin__modal-input" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Кредитов</label><input className="admin__modal-input" type="number" value={credits} onChange={e=>setCredits(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Бонус</label><input className="admin__modal-input" type="number" value={bonus} onChange={e=>setBonus(e.target.value)}/></div>
    {err&&<div className="admin__error">{err}</div>}{success&&<div className="admin__success">{success}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading}>{loading?'...':'Создать'}</button></div>
  </div></div>;
}

function EditPlanModal({plan,onClose,onDone}:{plan:PlanItem;onClose:()=>void;onDone:()=>void}) {
  const [name,setName]=useState(plan.name); const [credits,setCredits]=useState(String(plan.credits)); const [price,setPrice]=useState(String(plan.price_rub)); const [bonus,setBonus]=useState(String(plan.bonus_credits||0)); const [loading,setLoading]=useState(false); const [err,setErr]=useState(''); const [success,setSuccess]=useState('');
  const handle=async()=>{setLoading(true);setErr('');try{await api(`/plans/${plan.id}`,{method:'PATCH',body:JSON.stringify({name,credits:Number(credits),price_rub:Number(price),bonus_credits:Number(bonus)})});setSuccess('Сохранено!');setTimeout(onDone,1500)}catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Редактировать тариф</h3>
    <div className="admin__modal-field"><label className="admin__modal-label">Название</label><input className="admin__modal-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Премиум"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Цена (коп.)</label><input className="admin__modal-input" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Кредитов</label><input className="admin__modal-input" type="number" value={credits} onChange={e=>setCredits(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Бонус</label><input className="admin__modal-input" type="number" value={bonus} onChange={e=>setBonus(e.target.value)}/></div>
    {err&&<div className="admin__error">{err}</div>}{success&&<div className="admin__success">{success}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading}>{loading?'...':'Сохранить'}</button></div>
  </div></div>;
}

// ══════════════════════════════════
// Payments (unchanged)
// ══════════════════════════════════

function PaymentsSection() {
  const [txs,setTxs]=useState<TxItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{setLoading(true);api<{total:number;payments:TxItem[]}>(`/payments?limit=50&offset=${offset}`).then(d=>{setTxs(d.payments);setTotal(d.total)}).catch(e=>setErr(e.message)).finally(()=>setLoading(false))},[offset]);
  if(err)return<div className="admin__error">{err}</div>;
  const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Пользователь</th><th>Сумма</th><th>Кредиты</th><th>Описание</th><th>Дата</th></tr></thead><tbody>
      {txs.map(t=><tr key={t.id}><td>{t.id}</td><td>{t.user_email}</td><td style={{color:'#00b894'}}>{t.rub_amount} ₽</td><td>+{t.amount}</td><td style={{fontSize:12}}>{t.description}</td><td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(t.created_at).toLocaleString('ru-RU')}</td></tr>)}
      {txs.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Платежей нет</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// Credit Operations (unchanged)
// ══════════════════════════════════

function CreditsSection() {
  const [ops,setOps]=useState<CreditOp[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{setLoading(true);api<{total:number;ops:CreditOp[]}>(`/credit-ops?limit=50&offset=${offset}`).then(d=>{setOps(d.ops);setTotal(d.total)}).catch(e=>setErr(e.message)).finally(()=>setLoading(false))},[offset]);
  const opLabels:Record<string,string>={purchase:'Покупка',daily_free:'Ежедневные',promo:'Промокод',spend:'Списание',refund:'Возврат',manual_add:'Начисление',manual_remove:'Списание',bonus:'Бонус',compensation:'Компенсация'};
  if(err)return<div className="admin__error">{err}</div>;const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Пользователь</th><th>Тип</th><th>Кредиты</th><th>До→После</th><th>Источник</th><th>Комментарий</th><th>Дата</th></tr></thead><tbody>
      {ops.map(o=><tr key={o.id}><td>{o.id}</td><td>#{o.user_id}</td><td><span className="admin__badge admin__badge--active">{opLabels[o.op_type]||o.op_type}</span></td>
        <td style={{color:o.amount>0?'#00b894':'#e74c3c',fontWeight:600}}>{o.amount>0?'+':''}{o.amount}</td>
        <td style={{fontSize:12}}>{o.balance_before}→{o.balance_after}</td><td style={{fontSize:12}}>{o.source||'—'}</td><td style={{fontSize:12}}>{o.comment||'—'}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
      </tr>)}
      {ops.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет операций</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// Admin Log (unchanged)
// ══════════════════════════════════

function LogsSection() {
  const [logs,setLogs]=useState<LogItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{setLoading(true);api<{total:number;logs:LogItem[]}>(`/logs?limit=50&offset=${offset}`).then(d=>{setLogs(d.logs);setTotal(d.total)}).catch(e=>setErr(e.message)).finally(()=>setLoading(false))},[offset]);
  if(err)return<div className="admin__error">{err}</div>;const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Админ</th><th>Действие</th><th>Объект</th><th>Старое→Новое</th><th>IP</th><th>Результат</th><th>Дата</th></tr></thead><tbody>
      {logs.map(l=><tr key={l.id}><td style={{fontSize:12}}>{l.admin_email}</td><td style={{fontWeight:600}}>{l.action}</td><td style={{fontSize:12}}>#{l.target_type}/{l.target_id||''}</td><td style={{fontSize:11,color:'#8e8e9a',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{l.old_value}→{l.new_value}</td><td style={{fontSize:12}}>{l.ip||'—'}</td><td><span className={`admin__badge ${l.result==='error'?'admin__badge--blocked':'admin__badge--active'}`}>{l.result}</span></td><td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(l.created_at).toLocaleString('ru-RU')}</td></tr>)}
      {logs.length===0&&<tr><td colSpan={7} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет записей</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// System Errors (unchanged)
// ══════════════════════════════════

function ErrorsSection() {
  const [errors,setErrors]=useState<ErrorItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const fetchErrors=useCallback(()=>{setLoading(true);setErr('');api<{total:number;errors:ErrorItem[]}>(`/errors?limit=50&offset=${offset}`).then(d=>{setErrors(d.errors);setTotal(d.total)}).catch(e=>setErr(e.message)).finally(()=>setLoading(false))},[offset]);
  useEffect(()=>{fetchErrors()},[fetchErrors]);
  const updateErr=async(eid:number,s:string)=>{try{await api(`/errors/${eid}?status=${s}`,{method:'PATCH'});if(offset!==0)setOffset(0);else fetchErrors()}catch(e:any){setErr(e.message)}};
  if(err)return<div className="admin__error">{err}</div>;const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Код</th><th>Сервис</th><th>Текст</th><th>Повторов</th><th>Статус</th><th>Дата</th><th></th></tr></thead><tbody>
      {errors.map(e=><tr key={e.id}><td style={{fontFamily:'monospace',fontSize:12}}>{e.error_code||'—'}</td><td>{e.service}</td><td style={{fontSize:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis'}}>{e.error_text}</td><td><span className="admin__badge admin__badge--blocked">{e.repeat_count}</span></td>
        <td><span className={`admin__badge ${e.status==='fixed'?'admin__badge--active':e.status==='ignored'?'admin__badge--promo':'admin__badge--blocked'}`}>{e.status}</span></td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(e.created_at).toLocaleString('ru-RU')}</td>
        <td>{e.status==='new'&&<button className="admin__btn admin__btn-sm" onClick={()=>updateErr(e.id,'fixed')}>✓ fix</button>}</td>
      </tr>)}
      {errors.length===0&&<tr><td colSpan={7} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Ошибок нет</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// Promo Codes (unchanged)
// ══════════════════════════════════

function PromoSection() {
  const [promos,setPromos]=useState<PromoItem[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState(''); const [showCreate,setShowCreate]=useState(false);
  const fetch=useCallback(async()=>{setLoading(true);try{setPromos(await api<PromoItem[]>('/promo-codes'))}catch(e:any){setErr(e.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{fetch()},[fetch]);
  return <div>
    <div className="admin__section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><span className="admin__page-info">Промокодов: {promos.length}</span><button className="admin__btn admin__btn--primary" onClick={()=>setShowCreate(true)}>+ Создать</button></div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:<div className="admin__promo-grid">{promos.map(p=><div key={p.id} className="admin__promo-card"><div className="admin__promo-card-header"><span className="admin__promo-code">{p.code}</span><span className={`admin__badge ${p.is_active?'admin__badge--active':'admin__badge--blocked'}`}>{p.is_active?'active':'inactive'}</span></div><div className="admin__promo-detail">+{p.credits} кредитов</div><div className="admin__promo-detail">Использован: {p.used_count}/{p.max_uses||'∞'}</div><div className="admin__promo-detail" style={{fontSize:11}}>{p.expires_at?`до ${new Date(p.expires_at).toLocaleDateString('ru-RU')}`:'без срока'}</div><div className="admin__row" style={{marginTop:12}}><button className="admin__btn admin__btn-sm" onClick={async()=>{try{await api(`/promo-codes/${p.id}/toggle`,{method:'POST'});fetch()}catch(e:any){setErr(e.message)}}}>{p.is_active?'deactivate':'activate'}</button><button className="admin__btn admin__btn-sm admin__btn--danger" onClick={async()=>{if(!confirm('Удалить?'))return;try{await api(`/promo-codes/${p.id}`,{method:'DELETE'});fetch()}catch(e:any){setErr(e.message)}}}>delete</button></div></div>)}</div>}
    {showCreate&&<CreatePromoModal onClose={()=>setShowCreate(false)} onDone={()=>{setShowCreate(false);fetch()}} />}
  </div>;
}

function CreatePromoModal({onClose,onDone}:{onClose:()=>void;onDone:()=>void}) {
  const [code,setCode]=useState(''); const [credits,setCredits]=useState('100'); const [maxUses,setMaxUses]=useState('1'); const [days,setDays]=useState('30'); const [loading,setLoading]=useState(false); const [err,setErr]=useState(''); const [success,setSuccess]=useState('');
  const gen=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let r='';for(let i=0;i<8;i++)r+=c[Math.floor(Math.random()*c.length)];setCode(r)};
  const handle=async()=>{setLoading(true);setErr('');try{await api(`/promo-codes?code=${code}&credits=${credits}&max_uses=${maxUses}&expires_in_days=${days}`,{method:'POST'});setSuccess('Создано!');setTimeout(onDone,1500)}catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Создать промокод</h3>
    <div className="admin__modal-field"><label className="admin__modal-label">Код</label><div className="admin__row"><input className="admin__modal-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ПРОМО10"/><button className="admin__btn admin__btn-sm" onClick={gen}>🎲</button></div></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Кредитов</label><input className="admin__modal-input" type="number" min="1" value={credits} onChange={e=>setCredits(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Макс. использований (0=∞)</label><input className="admin__modal-input" type="number" min="0" value={maxUses} onChange={e=>setMaxUses(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Срок (дней)</label><input className="admin__modal-input" type="number" min="1" value={days} onChange={e=>setDays(e.target.value)}/></div>
    {err&&<div className="admin__error">{err}</div>}{success&&<div className="admin__success">{success}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading}>{loading?'...':'Создать'}</button></div>
  </div></div>;
}

// ══════════════════════════════════
// Roles (unchanged)
// ══════════════════════════════════

function RolesSection() {
  const [roles,setRoles]=useState<RoleItem[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState(''); const [showCreate,setShowCreate]=useState(false);
  const fetch=useCallback(async()=>{setLoading(true);try{setRoles(await api<RoleItem[]>('/roles'))}catch(e:any){setErr(e.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{fetch()},[fetch]);
  return <div>
    <div className="admin__section-head" style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><span className="admin__page-info">Ролей: {roles.length}</span><button className="admin__btn admin__btn--primary" onClick={()=>setShowCreate(true)}>+ Роль</button></div>
    {err&&<div className="admin__error">{err}</div>}{loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Название</th><th>Описание</th><th>Системная</th></tr></thead><tbody>
      {roles.map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td style={{fontSize:12,color:'#8e8e9a'}}>{r.description}</td><td>{r.is_system?<span className="admin__badge admin__badge--admin">system</span>:'—'}</td></tr>)}
    </tbody></table></div>}
    {showCreate&&<CreateRoleModal onClose={()=>setShowCreate(false)} onDone={()=>{setShowCreate(false);fetch()}} />}
  </div>;
}

function CreateRoleModal({onClose,onDone}:{onClose:()=>void;onDone:()=>void}) {
  const [name,setName]=useState(''); const [desc,setDesc]=useState(''); const [loading,setLoading]=useState(false); const [err,setErr]=useState('');
  const handle=async()=>{setLoading(true);try{await api(`/roles?name=${encodeURIComponent(name)}&description=${encodeURIComponent(desc)}`,{method:'POST'});onDone()}catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Новая роль</h3>
    <div className="admin__modal-field"><label className="admin__modal-label">Название</label><input className="admin__modal-input" value={name} onChange={e=>setName(e.target.value)}/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Описание</label><input className="admin__modal-input" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
    {err&&<div className="admin__error">{err}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading}>{loading?'...':'Создать'}</button></div>
  </div></div>;
}

// ══════════════════════════════════
// STAGE 2: Chats
// ══════════════════════════════════

function ChatsSection() {
  const [chats,setChats]=useState<ChatItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0);
  const [search,setSearch]=useState(''); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [viewSession,setViewSession]=useState<string|null>(null);

  const fetch=useCallback(async(q:string,off:number)=>{
    setLoading(true);setErr('');
    try {
      const p=new URLSearchParams({limit:'50',offset:String(off)});
      if(q)p.set('search',q);
      const d=await api<{total:number;chats:ChatItem[]}>(`/chats?${p}`);
      setChats(d.chats);setTotal(d.total);
    } catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[]);
  useEffect(()=>{fetch(search,offset)},[search,offset,fetch]);

  if(viewSession) {
    return <ChatViewer sessionId={viewSession} onBack={()=>setViewSession(null)} />;
  }

  const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    <div className="admin__search"><input className="admin__search-input" placeholder="Поиск по названию чата..." value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}}/><span className="admin__page-info">Чатов: {total}</span></div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Название</th><th>Пользователь</th><th>Модель</th><th>Сообщ.</th><th>Кредиты</th><th>OR Cost</th><th>Создан</th><th></th></tr></thead><tbody>
      {chats.map(c=><tr key={c.session_id}>
        <td><strong>{c.title}</strong></td><td>{c.user_email||`#${c.user_id}`}</td>
        <td style={{fontSize:12}}>{c.model||'—'}</td>
        <td>{c.message_count}</td>
        <td style={{color:'#00b894'}}>{c.credits_spent}</td>
        <td style={{fontSize:12}}>{c.or_cost.toFixed(4)}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(c.created_at).toLocaleDateString('ru-RU')}</td>
        <td><button className="admin__btn admin__btn-sm" onClick={()=>setViewSession(c.session_id)}>открыть</button></td>
      </tr>)}
      {chats.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Чатов нет</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

function ChatViewer({sessionId,onBack}:{sessionId:string;onBack:()=>void}) {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
  useEffect(()=>{api<any>(`/chats/${sessionId}`).then(setData).catch(e=>setErr(e.message))},[sessionId]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  return <div>
    <button className="admin__back-btn" onClick={onBack}>← Назад к списку</button>
    <h3 style={{margin:'16px 0'}}>{data.session?.title||'Чат'}</h3>
    <div className="admin__stats" style={{marginBottom:16}}>
      <div className="admin__stat-card"><div className="admin__stat-label">Модель</div><div className="admin__stat-value" style={{fontSize:16}}>{data.session?.model||'—'}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Сообщений</div><div className="admin__stat-value" style={{fontSize:16}}>{data.total}</div></div>
    </div>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Роль</th><th>Содержание</th><th>Модель</th><th>Tokens</th><th>OR Cost</th><th>Кредиты</th><th>Ошибка</th><th>Дата</th></tr></thead><tbody>
      {data.messages?.map((m:any)=><tr key={m.id}>
        <td><span className={`admin__badge ${m.role==='user'?'admin__badge--active':'admin__badge--promo'}`}>{m.role}</span></td>
        <td style={{fontSize:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={m.content}>{m.content.slice(0,100)}</td>
        <td style={{fontSize:11}}>{m.model||'—'}</td>
        <td style={{fontSize:11}}>{m.tokens_in||0}→{m.tokens_out||0}</td>
        <td style={{fontSize:11}}>{(m.cost_or||0).toFixed(4)}</td>
        <td style={{fontSize:11}}>{m.credits_spent||0}</td>
        <td style={{fontSize:11,color:'#e74c3c'}}>{m.error||'—'}</td>
        <td style={{fontSize:11,color:'#8e8e9a'}}>{new Date(m.created_at).toLocaleString('ru-RU')}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ══════════════════════════════════
// STAGE 2: Files
// ══════════════════════════════════

function QueriesSection() {
  const [queries,setQueries]=useState<QueryItem[]>([]); const [models,setModels]=useState<string[]>([]);
  const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0); const [search,setSearch]=useState('');
  const [model,setModel]=useState(''); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [expanded,setExpanded]=useState<number|null>(null);
  const fetch=useCallback(async()=>{
    setLoading(true);setErr('');
    try {
      const p=new URLSearchParams({limit:'50',offset:String(offset)});
      if(search.trim())p.set('search',search.trim());
      if(model)p.set('model',model);
      const d=await api<{total:number;models:string[];queries:QueryItem[]}>(`/queries?${p}`);
      setQueries(d.queries);setModels(d.models);setTotal(d.total);
    } catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[offset,search,model]);
  useEffect(()=>{const timer=setTimeout(fetch,250);return()=>clearTimeout(timer)},[fetch]);
  const pages=Math.ceil(total/50);const page=Math.floor(offset/50)+1;
  return <div>
    <div className="admin__row" style={{marginBottom:16,alignItems:'center'}}>
      <input className="admin__search-input" style={{flex:'1 1 320px'}} placeholder="Поиск по запросу, email или названию чата..." value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}} />
      <select className="admin__select" value={model} onChange={e=>{setModel(e.target.value);setOffset(0)}}>
        <option value="">Все модели</option>
        {models.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
      <span className="admin__page-info">Запросов: {total}</span>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Запрос</th><th>Пользователь</th><th>Чат</th><th>Модель</th><th>Дата</th><th></th></tr></thead><tbody>
      {queries.map(item=><tr key={item.id}>
        <td style={{minWidth:260,maxWidth:520}}><div style={{whiteSpace:expanded===item.id?'pre-wrap':'nowrap',overflow:'hidden',textOverflow:'ellipsis',wordBreak:'break-word'}}>{item.content}</div>{item.has_attachments&&<span className="admin__badge admin__badge--promo" style={{marginTop:6}}>есть вложение</span>}</td>
        <td style={{fontSize:12}}>{item.user_email}<br/><span style={{color:'#8e8e9a'}}>#{item.user_id}</span></td>
        <td style={{fontSize:12,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={item.title}>{item.title||'Без названия'}</td>
        <td style={{fontSize:11}}>{item.model||'—'}</td>
        <td style={{fontSize:12,color:'#8e8e9a',whiteSpace:'nowrap'}}>{new Date(item.created_at).toLocaleString('ru-RU')}</td>
        <td><button className="admin__btn admin__btn-sm" onClick={()=>setExpanded(expanded===item.id?null:item.id)}>{expanded===item.id?'свернуть':'полностью'}</button></td>
      </tr>)}
      {queries.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Запросов пока нет</td></tr>}
    </tbody></table></div>}
    {pages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{page}/{pages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

function FilesSection() {
  const [files,setFiles]=useState<FileItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0);
  const [statusFilter,setStatusFilter]=useState(''); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const fetch=useCallback(async()=>{
    setLoading(true);setErr('');
    try {
      const p=new URLSearchParams({limit:'50',offset:String(offset)});
      if(statusFilter)p.set('status',statusFilter);
      const d=await api<{total:number;files:FileItem[]}>(`/files?${p}`);
      setFiles(d.files);setTotal(d.total);
    } catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[offset,statusFilter]);
  useEffect(()=>{fetch()},[fetch]);
  const updateFile=async(id:number,field:string,val:any)=>{try{await api(`/files/${id}?${field}=${val}`,{method:'PATCH'});fetch()}catch(e:any){setErr(e.message)}};
  const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  const statusColors:Record<string,string>={uploaded:'#fdcb6e',processing:'#6c5ce7',processed:'#00b894',error:'#e74c3c',deleted:'#8e8e9a',blocked:'#d63031'};
  return <div>
    <div className="admin__row" style={{marginBottom:16}}>
      <span style={{fontSize:13,color:'var(--text-secondary)'}}>Статус:</span>
      <select className="admin__select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setOffset(0)}}>
        <option value="">Все</option>
        <option value="uploaded">Загружен</option><option value="processing">Обрабатывается</option>
        <option value="processed">Обработан</option><option value="error">Ошибка</option><option value="blocked">Заблокирован</option>
      </select>
      <span className="admin__page-info">Файлов: {total}</span>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Файл</th><th>Тип</th><th>Размер</th><th>Статус</th><th>Пользователь</th><th>Загружен</th><th></th></tr></thead><tbody>
      {files.map(f=><tr key={f.id}>
        <td>{f.id}</td>
        <td style={{fontSize:12}}>{f.original_name}</td>
        <td style={{fontSize:11,color:'#8e8e9a'}}>{f.mime_type||'—'}</td>
        <td style={{fontSize:12}}>{f.size_bytes>1048576?`${(f.size_bytes/1048576).toFixed(1)} MB`:`${(f.size_bytes/1024).toFixed(0)} KB`}</td>
        <td><span className="admin__badge" style={{background:statusColors[f.status]||'#8e8e9a',color:'#fff'}}>{f.status}</span></td>
        <td style={{fontSize:12}}>#{f.user_id}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(f.created_at).toLocaleDateString('ru-RU')}</td>
        <td><button className={`admin__btn admin__btn-sm ${f.is_blocked?'admin__btn--success':'admin__btn--danger'}`} onClick={()=>updateFile(f.id,'is_blocked',f.is_blocked?'false':'true')}>{f.is_blocked?'unblock':'block'}</button></td>
      </tr>)}
      {files.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Файлов нет</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// STAGE 2: Support Tickets
// ══════════════════════════════════

const ticketLabels:Record<string,string>={general:'Общий вопрос',billing:'Оплата и тарифы',technical:'Техническая проблема',feature:'Предложение',bug:'Ошибка',payment:'Оплата',credits:'Списание кредитов',model_error:'Ошибка модели',files:'Работа с файлами',auth:'Авторизация',data_deletion:'Удаление данных',other:'Другое'};
const priorityColors:Record<string,string>={low:'#8e8e9a',normal:'#6c5ce7',high:'#fdcb6e',urgent:'#e74c3c'};
const statusColors:Record<string,string>={new:'#e74c3c',in_progress:'#fdcb6e',waiting_user:'#6c5ce7',resolved:'#00b894',closed:'#8e8e9a'};

function TicketsSection() {
  const [tickets,setTickets]=useState<TicketItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0);
  const [statusFilter,setStatusFilter]=useState(''); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [viewTicket,setViewTicket]=useState<number|null>(null);

  const fetch=useCallback(async()=>{
    setLoading(true);setErr('');
    try {
      const p=new URLSearchParams({limit:'50',offset:String(offset)});
      if(statusFilter)p.set('status',statusFilter);
      const d=await api<{total:number;tickets:TicketItem[]}>(`/tickets?${p}`);
      setTickets(d.tickets);setTotal(d.total);
    } catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[offset,statusFilter]);
  useEffect(()=>{fetch()},[fetch]);

  if(viewTicket) return <TicketViewer ticketId={viewTicket} onBack={()=>setViewTicket(null)} onUpdate={()=>fetch()} />;

  const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    <div className="admin__row" style={{marginBottom:16}}>
      <span style={{fontSize:13,color:'var(--text-secondary)'}}>Статус:</span>
      <select className="admin__select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setOffset(0)}}>
        <option value="">Все</option><option value="new">Новые</option><option value="in_progress">В работе</option>
        <option value="waiting_user">Ожидает</option><option value="resolved">Решено</option><option value="closed">Закрыто</option>
      </select>
      <span className="admin__page-info">Обращений: {total}</span>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Тема</th><th>Пользователь</th><th>Категория</th><th>Приоритет</th><th>Статус</th><th>Дата</th><th></th></tr></thead><tbody>
      {tickets.map(t=><tr key={t.id}>
        <td>{t.id}</td>
        <td><strong>{t.subject}</strong></td>
        <td style={{fontSize:12}}>{t.user_email}</td>
        <td style={{fontSize:12}}>{ticketLabels[t.category]||t.category}</td>
        <td><span className="admin__badge" style={{background:priorityColors[t.priority]||'#8e8e9a',color:'#fff'}}>{t.priority}</span></td>
        <td><span className="admin__badge" style={{background:statusColors[t.status]||'#8e8e9a',color:'#fff'}}>{t.status}</span></td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
        <td><button className="admin__btn admin__btn-sm" onClick={()=>setViewTicket(t.id)}>открыть</button></td>
      </tr>)}
      {tickets.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Обращений нет</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

function TicketViewer({ticketId,onBack,onUpdate}:{ticketId:number;onBack:()=>void;onUpdate:()=>void}) {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
  const [newMsg,setNewMsg]=useState(''); const [isInternal,setIsInternal]=useState(false); const [sending,setSending]=useState(false);
  const [newStatus,setNewStatus]=useState('');
  const fetchData=useCallback(()=>{api<any>(`/tickets/${ticketId}`).then(setData).catch(e=>setErr(e.message))},[ticketId]);
  useEffect(()=>{fetchData()},[fetchData]);
  const handleStatus=async()=>{if(!newStatus)return;try{await api(`/tickets/${ticketId}?status=${newStatus}`,{method:'PATCH'});fetchData();onUpdate();setNewStatus('')}catch(e:any){setErr(e.message)}};
  const handleSend=async()=>{if(!newMsg.trim())return;setSending(true);try{await api(`/tickets/${ticketId}/message`,{method:'POST',body:JSON.stringify({content:newMsg,is_internal:isInternal})});setNewMsg('');fetchData();onUpdate()}catch(e:any){setErr(e.message)}finally{setSending(false)}};
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  const t=data.ticket;
  return <div>
    <button className="admin__back-btn" onClick={onBack}>← Назад к списку</button>
    <h3 style={{margin:'16px 0'}}>{t.subject}</h3>
    <div className="admin__stats" style={{marginBottom:16}}>
      <div className="admin__stat-card"><div className="admin__stat-label">Пользователь</div><div className="admin__stat-value" style={{fontSize:14}}>{t.user_email}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Категория</div><div className="admin__stat-value" style={{fontSize:14}}>{ticketLabels[t.category]||t.category}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Приоритет</div><div className="admin__stat-value" style={{fontSize:14}}><span className="admin__badge" style={{background:priorityColors[t.priority],color:'#fff'}}>{t.priority}</span></div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Статус</div><div className="admin__stat-value" style={{fontSize:14}}><span className="admin__badge" style={{background:statusColors[t.status],color:'#fff'}}>{t.status}</span></div></div>
    </div>
    <div className="admin__row" style={{marginBottom:16,gap:8}}>
      <select className="admin__select" value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{width:160}}>
        <option value="">Изменить статус</option>
        <option value="new">Новое</option><option value="in_progress">В работе</option>
        <option value="waiting_user">Ожидает пользователя</option><option value="resolved">Решено</option><option value="closed">Закрыто</option>
      </select>
      <button className="admin__btn admin__btn-sm" onClick={handleStatus} disabled={!newStatus}>Применить</button>
    </div>
    <h4 style={{margin:'16px 0 8px',fontSize:14,color:'var(--text-secondary)'}}>Сообщения</h4>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Автор</th><th>Сообщение</th><th>Тип</th><th>Дата</th></tr></thead><tbody>
      {data.messages?.map((m:any)=><tr key={m.id}>
        <td style={{fontSize:12}}>{m.user_id===0?'Admin':`#${m.user_id}`}</td>
        <td style={{fontSize:12}}>{m.content}</td>
        <td>{m.is_internal?<span className="admin__badge admin__badge--promo">internal</span>:<span className="admin__badge admin__badge--active">public</span>}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(m.created_at).toLocaleString('ru-RU')}</td>
      </tr>)}
    </tbody></table></div>
    <div className="admin__row" style={{marginTop:16,gap:8,alignItems:'flex-end'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:4}}>
        <input className="admin__modal-input" value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder="Напишите ответ..." />
        <label className="admin__row" style={{gap:4,fontSize:12}}><input type="checkbox" checked={isInternal} onChange={e=>setIsInternal(e.target.checked)}/> Внутренняя заметка (админ)</label>
      </div>
      <button className="admin__btn admin__btn--primary admin__btn-sm" onClick={handleSend} disabled={sending||!newMsg.trim()}>{sending?'...':'Отправить'}</button>
    </div>
  </div>;
}

// ══════════════════════════════════
// STAGE 2: Message Feedback Stats (👍/👎)
// ══════════════════════════════════

interface ModelFeedbackStats {
  total: number;
  likes: number;
  dislikes: number;
  regenerations: number;
  satisfaction_rate: number;
  per_model: {
    model: string;
    total: number;
    likes: number;
    dislikes: number;
    satisfaction: number;
  }[];
  recent: {
    id: number;
    session_id: string;
    message_index: number;
    user_id: number;
    feedback_type: string;
    model: string;
    created_at: string | null;
  }[];
}

function ModelFeedbackSection() {
  const [stats, setStats] = useState<ModelFeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api<ModelFeedbackStats>(`/feedback-stats?limit=100`);
      setStats(d);
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, []);

  useEffect(() => { fetch() }, [fetch]);

  if (err) return <div className="admin__error">{err}</div>;
  if (loading || !stats) return <div className="admin__loading">Загрузка...</div>;

  const totalFeedback = stats.total;
  const satisfactionPct = (stats.satisfaction_rate * 100).toFixed(1);

  return <div>
    {/* Stat cards */}
    <div className="admin__stats" style={{ marginBottom: 16 }}>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Всего оценок</div>
        <div className="admin__stat-value">{totalFeedback}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">👍 Лайки</div>
        <div className="admin__stat-value admin__stat-value--users">{stats.likes}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">👎 Дизлайки</div>
        <div className="admin__stat-value admin__stat-value--blocked">{stats.dislikes}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">🔄 Регенерации</div>
        <div className="admin__stat-value">{stats.regenerations}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">😊 Удовлетворённость</div>
        <div className={`admin__stat-value ${parseFloat(satisfactionPct) >= 70 ? 'admin__stat-value--users' : parseFloat(satisfactionPct) >= 40 ? '' : 'admin__stat-value--blocked'}`}>
          {satisfactionPct}%
        </div>
      </div>
    </div>

    {/* Per-model breakdown */}
    {stats.per_model.length > 0 && <>
      <h4 style={{ margin: '16px 0 8px', fontSize: 14, color: 'var(--text-secondary)' }}>По моделям</h4>
      <div className="admin__table-wrapper">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Модель</th>
              <th>Всего</th>
              <th>👍 Лайки</th>
              <th>👎 Дизлайки</th>
              <th>😊 Satisfaction</th>
            </tr>
          </thead>
          <tbody>
            {stats.per_model.map(m => {
              const satPct = (m.satisfaction * 100).toFixed(1);
              return <tr key={m.model}>
                <td><strong>{m.model}</strong></td>
                <td>{m.total}</td>
                <td style={{ color: '#00b894' }}>{m.likes}</td>
                <td style={{ color: '#e74c3c' }}>{m.dislikes}</td>
                <td>
                  <span className={`admin__badge ${parseFloat(satPct) >= 70 ? 'admin__badge--active' : parseFloat(satPct) >= 40 ? 'admin__badge--promo' : 'admin__badge--blocked'}`}>
                    {satPct}%
                  </span>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>}

    {/* Recent feedback entries */}
    {stats.recent.length > 0 && <>
      <h4 style={{ margin: '16px 0 8px', fontSize: 14, color: 'var(--text-secondary)' }}>Последние оценки</h4>
      <div className="admin__table-wrapper">
        <table className="admin__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Пользователь</th>
              <th>Модель</th>
              <th>Оценка</th>
              <th>Сессия</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>#{r.user_id}</td>
                <td style={{ fontSize: 12 }}>{r.model || '—'}</td>
                <td>
                  <span className={`admin__badge ${r.feedback_type === 'like' ? 'admin__badge--active' : r.feedback_type === 'dislike' ? 'admin__badge--blocked' : ''}`}>
                    {r.feedback_type === 'like' ? '👍' : r.feedback_type === 'dislike' ? '👎' : r.feedback_type === 'regenerate' ? '🔄' : r.feedback_type}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: '#8e8e9a' }}>{r.session_id.slice(0, 8)}...</td>
                <td style={{ fontSize: 12, color: '#8e8e9a' }}>{r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>}

    {totalFeedback === 0 && (
      <div className="admin__empty" style={{ textAlign: 'center', padding: 40, color: '#8e8e9a' }}>
        Пока нет оценок ответов. Когда пользователи начнут ставить 👍/👎, статистика появится здесь.
      </div>
    )}
  </div>;
}

// ══════════════════════════════════
// STAGE 2: Notifications
// ══════════════════════════════════

function NotificationsSection() {
  const [notifs,setNotifs]=useState<NotifItem[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const fetch=useCallback(async()=>{setLoading(true);try{setNotifs(await api<NotifItem[]>('/notifications'))}catch(e:any){setErr(e.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{fetch()},[fetch]);
  return <div>
    <div className="admin__section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <span className="admin__page-info">Уведомлений: {notifs.length}</span>
      <button className="admin__btn admin__btn--primary" onClick={()=>setShowCreate(true)}>+ Создать</button>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Заголовок</th><th>Текст</th><th>Аудитория</th><th>Канал</th><th>Статус</th><th>Отпр.</th><th>Дата</th><th></th></tr></thead><tbody>
      {notifs.map(n=><tr key={n.id}>
        <td><strong>{n.title}</strong></td>
        <td style={{fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.text}</td>
        <td style={{fontSize:12}}><span className="admin__badge admin__badge--active">{n.audience}</span></td>
        <td style={{fontSize:12}}>{n.channel}</td>
        <td><span className={`admin__badge ${n.is_active?'admin__badge--active':'admin__badge--blocked'}`}>{n.is_active?'active':'inactive'}</span></td>
        <td style={{fontSize:12}}>{n.sent_count}/{n.opened_count}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(n.created_at).toLocaleDateString('ru-RU')}</td>
        <td><button className="admin__btn admin__btn-sm admin__btn--danger" onClick={async()=>{if(!confirm('Удалить?'))return;try{await api(`/notifications/${n.id}`,{method:'DELETE'});fetch()}catch(e:any){setErr(e.message)}}}>del</button></td>
      </tr>)}
      {notifs.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Уведомлений нет</td></tr>}
    </tbody></table></div>}
    {showCreate&&<CreateNotifModal onClose={()=>setShowCreate(false)} onDone={()=>{setShowCreate(false);fetch()}} />}
  </div>;
}

function CreateNotifModal({onClose,onDone}:{onClose:()=>void;onDone:()=>void}) {
  const [title,setTitle]=useState(''); const [text,setText]=useState(''); const [audience,setAudience]=useState('all');
  const [channel,setChannel]=useState('site'); const [loading,setLoading]=useState(false); const [err,setErr]=useState(''); const [success,setSuccess]=useState('');
  const handle=async()=>{setLoading(true);setErr('');try{
    await api(`/notifications?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&audience=${audience}&channel=${channel}`,{method:'POST'});
    setSuccess('Создано!');setTimeout(onDone,1500);
  }catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Новое уведомление</h3>
    <div className="admin__modal-field"><label className="admin__modal-label">Заголовок</label><input className="admin__modal-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Важное обновление"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Текст</label><textarea className="admin__modal-input" rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="Текст уведомления"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Аудитория</label><select className="admin__select" value={audience} onChange={e=>setAudience(e.target.value)} style={{width:'100%'}}>
      <option value="all">Все пользователи</option><option value="new">Новые</option><option value="paid">Платные</option><option value="zero_balance">Нулевой баланс</option>
    </select></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Канал</label><select className="admin__select" value={channel} onChange={e=>setChannel(e.target.value)} style={{width:'100%'}}>
      <option value="site">Сайт</option><option value="email">Email</option><option value="both">Оба</option>
    </select></div>
    {err&&<div className="admin__error">{err}</div>}{success&&<div className="admin__success">{success}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading||!title||!text}>{loading?'...':'Создать'}</button></div>
  </div></div>;
}

// ══════════════════════════════════
// STAGE 2: Feedback
// ══════════════════════════════════

interface FeedbackItem {
  id: number;
  user_id: number;
  user_email: string;
  type: string;
  subject: string;
  message: string;
  rating: number|null;
  source: string;
  status: string;
  created_at: string;
}

const feedbackTypeLabels: Record<string,string> = {
  idea: '💡 Идея',
  bug: '🐛 Ошибка',
  feature: '✨ Улучшение',
  complaint: '😠 Жалоба',
  praise: '👍 Похвала',
  other: '📝 Другое',
};
const feedbackStatusColors: Record<string,string> = {
  new: '#6c5ce7',
  read: '#fdcb6e',
  replied: '#00b894',
  closed: '#8e8e9a',
};
const feedbackStatusLabels: Record<string,string> = {
  new: 'Новый',
  read: 'Прочитан',
  replied: 'Отвечен',
  closed: 'Закрыт',
};

function FeedbacksSection() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewFeedback, setViewFeedback] = useState<number|null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams({limit: '50', offset: String(offset)});
      if (statusFilter) p.set('status', statusFilter);
      if (typeFilter) p.set('type', typeFilter);
      const d = await api<{total: number; feedbacks: FeedbackItem[]}>(`/feedbacks?${p}`);
      setFeedbacks(d.feedbacks);
      setTotal(d.total);
    } catch(e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [offset, statusFilter, typeFilter]);

  useEffect(() => { fetch() }, [fetch]);

  if (viewFeedback) {
    return <FeedbackViewer feedbackId={viewFeedback} onBack={() => setViewFeedback(null)} onUpdate={() => fetch()} />;
  }

  // Count by status for stats cards
  const newCount = feedbacks.filter(f => f.status === 'new').length;
  const repliedCount = feedbacks.filter(f => f.status === 'replied').length;
  const closedCount = feedbacks.filter(f => f.status === 'closed').length;
  const readCount = feedbacks.filter(f => f.status === 'read').length;

  const totPages = Math.ceil(total / 50);
  const curPage = Math.floor(offset / 50) + 1;

  return <div>
    {/* Stats cards */}
    <div className="admin__stats" style={{marginBottom: 16}}>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Всего отзывов</div>
        <div className="admin__stat-value">{total}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Новые</div>
        <div className="admin__stat-value admin__stat-value--new">{newCount}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Прочитано</div>
        <div className="admin__stat-value admin__stat-value--read">{readCount}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Отвечено</div>
        <div className="admin__stat-value admin__stat-value--replied">{repliedCount}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Закрыто</div>
        <div className="admin__stat-value admin__stat-value--closed">{closedCount}</div>
      </div>
    </div>

    {/* Filters */}
    <div className="admin__row" style={{marginBottom: 16}}>
      <span style={{fontSize: 13, color: 'var(--text-secondary)'}}>Статус:</span>
      <select className="admin__select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setOffset(0) }}>
        <option value="">Все</option>
        <option value="new">Новые</option>
        <option value="read">Прочитаны</option>
        <option value="replied">Отвечены</option>
        <option value="closed">Закрыты</option>
      </select>
      <span style={{fontSize: 13, color: 'var(--text-secondary)'}}>Тип:</span>
      <select className="admin__select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setOffset(0) }}>
        <option value="">Все</option>
        <option value="idea">Идея</option>
        <option value="bug">Ошибка</option>
        <option value="feature">Улучшение</option>
        <option value="complaint">Жалоба</option>
        <option value="praise">Похвала</option>
        <option value="other">Другое</option>
      </select>
      <span className="admin__page-info">Отзывов: {total}</span>
    </div>

    {err && <div className="admin__error">{err}</div>}

    {loading ? <div className="admin__loading">Загрузка...</div> :
    <div className="admin__table-wrapper">
      <table className="admin__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Пользователь</th>
            <th>Тип</th>
            <th>Тема</th>
            <th>Оценка</th>
            <th>Источник</th>
            <th>Статус</th>
            <th>Дата</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {feedbacks.map(f => <tr key={f.id}>
            <td>{f.id}</td>
            <td style={{fontSize: 12}}>{f.user_email || `#${f.user_id}`}</td>
            <td style={{fontSize: 12}}>{feedbackTypeLabels[f.type] || f.type}</td>
            <td style={{fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              <strong>{f.subject}</strong>
            </td>
            <td>{f.rating !== null ? <span className="admin__badge admin__badge--rating">{f.rating}/5</span> : '—'}</td>
            <td style={{fontSize: 12}}>{f.source || '—'}</td>
            <td>
              <span
                className="admin__badge"
                style={{background: feedbackStatusColors[f.status] || '#8e8e9a', color: '#fff'}}
              >
                {feedbackStatusLabels[f.status] || f.status}
              </span>
            </td>
            <td style={{fontSize: 12, color: '#8e8e9a'}}>
              {new Date(f.created_at).toLocaleDateString('ru-RU')}
            </td>
            <td>
              <button className="admin__btn admin__btn-sm" onClick={() => setViewFeedback(f.id)}>открыть</button>
            </td>
          </tr>)}
          {feedbacks.length === 0 && <tr><td colSpan={9} style={{textAlign: 'center', color: '#8e8e9a', padding: 24}}>Отзывов нет</td></tr>}
        </tbody>
      </table>
    </div>}

    {totPages > 1 && <div className="admin__pagination">
      <button className="admin__btn admin__btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>←</button>
      <span className="admin__page-info">{curPage}/{totPages}</span>
      <button className="admin__btn admin__btn-sm" disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>→</button>
    </div>}
  </div>;
}

function FeedbackViewer({feedbackId, onBack, onUpdate}: {feedbackId: number; onBack: () => void; onUpdate: () => void}) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [reply, setReply] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(() => {
    api<any>(`/feedbacks/${feedbackId}`).then(setData).catch(e => setErr(e.message));
  }, [feedbackId]);

  useEffect(() => { fetchData() }, [fetchData]);

  const handleStatus = async () => {
    if (!newStatus) return;
    try {
      await api(`/feedbacks/${feedbackId}?status=${newStatus}`, {method: 'PATCH'});
      fetchData(); onUpdate(); setNewStatus('');
    } catch(e: any) { setErr(e.message) }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api(`/feedbacks/${feedbackId}/reply?message=${encodeURIComponent(reply)}`, {method: 'POST'});
      setReply(''); fetchData(); onUpdate();
    } catch(e: any) { setErr(e.message) }
    finally { setSending(false) }
  };

  if (err) return <div className="admin__error">{err}</div>;
  if (!data) return <div className="admin__loading">Загрузка...</div>;

  const f = data.feedback;

  return <div>
    <button className="admin__back-btn" onClick={onBack}>← Назад к списку</button>
    <h3 style={{margin: '16px 0'}}>{f.subject}</h3>

    <div className="admin__stats" style={{marginBottom: 16}}>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Пользователь</div>
        <div className="admin__stat-value" style={{fontSize: 14}}>{f.user_email || `#${f.user_id}`}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Тип</div>
        <div className="admin__stat-value" style={{fontSize: 14}}>{feedbackTypeLabels[f.type] || f.type}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Оценка</div>
        <div className="admin__stat-value" style={{fontSize: 14}}>
          {f.rating !== null ? <span className="admin__badge admin__badge--rating" style={{fontSize: 14, padding: '4px 12px'}}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span> : '—'}
        </div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Статус</div>
        <div className="admin__stat-value" style={{fontSize: 14}}>
          <span className="admin__badge" style={{background: feedbackStatusColors[f.status], color: '#fff', fontSize: 14, padding: '4px 12px'}}>
            {feedbackStatusLabels[f.status] || f.status}
          </span>
        </div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Источник</div>
        <div className="admin__stat-value" style={{fontSize: 14}}>{f.source || '—'}</div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Дата</div>
        <div className="admin__stat-value" style={{fontSize: 14}}>{new Date(f.created_at).toLocaleString('ru-RU')}</div>
      </div>
    </div>

    {/* Message content */}
    <div style={{background: 'var(--bg-card, #1a1a25)', border: '1px solid var(--border-color, #2a2a35)', borderRadius: 12, padding: 20, marginBottom: 16, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
      {f.message}
    </div>

    {/* Admin reply */}
    {data.replies?.map((r: any) => <div key={r.id} style={{
      background: 'rgba(108, 92, 231, 0.05)',
      border: '1px solid rgba(108, 92, 231, 0.2)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      fontSize: 13,
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      <div style={{fontSize: 11, color: '#8e8e9a', marginBottom: 6}}>
        ✉️ Ответ администратора · {new Date(r.created_at).toLocaleString('ru-RU')}
      </div>
      {r.message}
    </div>)}

    {/* Status change */}
    <div className="admin__row" style={{marginBottom: 16, gap: 8}}>
      <select className="admin__select" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{width: 160}}>
        <option value="">Изменить статус</option>
        <option value="read">Прочитан</option>
        <option value="replied">Отвечен</option>
        <option value="closed">Закрыт</option>
      </select>
      <button className="admin__btn admin__btn-sm" onClick={handleStatus} disabled={!newStatus}>Применить</button>
    </div>

    {/* Reply form */}
    <div className="admin__row" style={{alignItems: 'flex-end', gap: 8}}>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4}}>
        <input className="admin__modal-input" value={reply} onChange={e => setReply(e.target.value)} placeholder="Напишите ответ пользователю..." />
      </div>
      <button className="admin__btn admin__btn--primary admin__btn-sm" onClick={handleReply} disabled={sending || !reply.trim()}>
        {sending ? '...' : 'Ответить'}
      </button>
    </div>
  </div>;
}

// ══════════════════════════════════
// STAGE 2: Fraud Alerts
// ══════════════════════════════════

const riskColors:Record<string,string>={low:'#8e8e9a',medium:'#fdcb6e',high:'#e17055',critical:'#e74c3c'};
const fraudStatusColors:Record<string,string>={new:'#e74c3c',investigating:'#fdcb6e',blocked:'#d63031',resolved:'#00b894',ignored:'#8e8e9a'};
const fraudTypeLabels:Record<string,string>={mass_registrations:'Массовые регистрации',multi_account:'Мультиаккаунты',rapid_requests:'Частые запросы',proxy_vpn:'Прокси/VPN',anomalous_spending:'Аномальные расходы',duplicate_payment:'Дубликаты платежей',bot:'Бот',brute_force:'Подбор пароля',dangerous_file:'Опасный файл'};

function FraudSection() {
  const [alerts,setAlerts]=useState<FraudItem[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0);
  const [statusFilter,setStatusFilter]=useState(''); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const fetch=useCallback(async()=>{
    setLoading(true);setErr('');
    try {
      const p=new URLSearchParams({limit:'50',offset:String(offset)});
      if(statusFilter)p.set('status',statusFilter);
      const d=await api<{total:number;alerts:FraudItem[]}>(`/fraud-alerts?${p}`);
      setAlerts(d.alerts);setTotal(d.total);
    } catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[offset,statusFilter]);
  useEffect(()=>{fetch()},[fetch]);
  const updateAlert=async(id:number,field:string,val:string)=>{try{await api(`/fraud-alerts/${id}?${field}=${val}`,{method:'PATCH'});fetch()}catch(e:any){setErr(e.message)}};
  const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    <div className="admin__row" style={{marginBottom:16}}>
      <span style={{fontSize:13,color:'var(--text-secondary)'}}>Статус:</span>
      <select className="admin__select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setOffset(0)}}>
        <option value="">Все</option><option value="new">Новые</option><option value="investigating">Расследуется</option>
        <option value="blocked">Заблокировано</option><option value="resolved">Решено</option><option value="ignored">Игнор</option>
      </select>
      <span className="admin__page-info">Срабатываний: {total}</span>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Тип</th><th>Риск</th><th>Пользователь</th><th>IP</th><th>Описание</th><th>Статус</th><th>Действие</th><th>Дата</th></tr></thead><tbody>
      {alerts.map(a=><tr key={a.id}>
        <td style={{fontSize:12}}>{fraudTypeLabels[a.alert_type]||a.alert_type}</td>
        <td><span className="admin__badge" style={{background:riskColors[a.risk_level]||'#8e8e9a',color:'#fff'}}>{a.risk_level}</span></td>
        <td style={{fontSize:12}}>{a.user_id?`#${a.user_id}`:'—'}</td>
        <td style={{fontSize:11,fontFamily:'monospace'}}>{a.ip_address||'—'}</td>
        <td style={{fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.description}</td>
        <td><span className="admin__badge" style={{background:fraudStatusColors[a.status]||'#8e8e9a',color:'#fff'}}>{a.status}</span></td>
        <td><select className="admin__select" style={{width:130,fontSize:11}} value="" onChange={e=>{const v=e.target.value;if(v)updateAlert(a.id,'action_taken',v)}}><option value="">Действие</option><option value="temp_block">Врем. блок</option><option value="limit_free">Лимит беспл.</option><option value="captcha">CAPTCHA</option><option value="ip_block">Блок IP</option><option value="account_block">Блок аккаунта</option></select></td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
      </tr>)}
      {alerts.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Срабатываний нет</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// STAGE 2: Analytics
// ══════════════════════════════════

function AnalyticsSection() {
  const [data,setData]=useState<any>(null); const [funnel,setFunnel]=useState<any>(null); const [days,setDays]=useState(30); const [err,setErr]=useState('');
  useEffect(()=>{
    api<any>(`/analytics/overview?days=${days}`).then(setData).catch(e=>setErr(e.message));
    api<any>('/analytics/funnel').then(setFunnel).catch(()=>{});
  },[days]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data||!funnel)return<div className="admin__loading">Загрузка аналитики...</div>;

  const cu=data.credit_usage||{};
  const maxVal = Math.max(cu.paid||1, cu.free||1, cu.bonus||1);

  return <div>
    <div className="admin__row" style={{marginBottom:16}}>
      <span style={{fontSize:13,color:'var(--text-secondary)'}}>Период:</span>
      <select className="admin__select" value={days} onChange={e=>setDays(Number(e.target.value))}>
        <option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option>
      </select>
    </div>

    {/* Credit usage bar */}
    <h4 style={{margin:'0 0 12px',fontSize:14,color:'var(--text-secondary)'}}>Использование кредитов</h4>
    <div className="admin__stats" style={{marginBottom:24}}>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Платные</div>
        <div className="admin__stat-value" style={{color:'#00b894',fontSize:24}}>{cu.paid}</div>
        <div style={{height:4,background:'#eee',borderRadius:4,marginTop:8}}><div style={{width:`${(cu.paid||0)/maxVal*100}%`,height:4,background:'#00b894',borderRadius:4}}/></div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Бесплатные</div>
        <div className="admin__stat-value" style={{color:'#6c5ce7',fontSize:24}}>{cu.free}</div>
        <div style={{height:4,background:'#eee',borderRadius:4,marginTop:8}}><div style={{width:`${(cu.free||0)/maxVal*100}%`,height:4,background:'#6c5ce7',borderRadius:4}}/></div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Бонусные</div>
        <div className="admin__stat-value" style={{color:'#fdcb6e',fontSize:24}}>{cu.bonus}</div>
        <div style={{height:4,background:'#eee',borderRadius:4,marginTop:8}}><div style={{width:`${(cu.bonus||0)/maxVal*100}%`,height:4,background:'#fdcb6e',borderRadius:4}}/></div>
      </div>
      <div className="admin__stat-card">
        <div className="admin__stat-label">Ошибки OR</div>
        <div className="admin__stat-value" style={{color:'#e74c3c',fontSize:24}}>{data.or_error_count}</div>
      </div>
    </div>

    {/* Funnel */}
    <h4 style={{margin:'0 0 12px',fontSize:14,color:'var(--text-secondary)'}}>Воронка конверсии</h4>
    <div className="admin__table-wrapper" style={{marginBottom:24}}>
      <table className="admin__table"><thead><tr><th>Этап</th><th>Количество</th><th>Конверсия</th></tr></thead><tbody>
        {funnel.funnel?.map((f:any,i:number)=><tr key={i}>
          <td>{f.stage}</td>
          <td style={{fontWeight:600,fontSize:18}}>{f.count}</td>
          <td>{f.conversion!==undefined?<span className="admin__badge" style={{background:f.conversion>50?'#00b894':'#fdcb6e',color:'#fff'}}>{f.conversion}%</span>:'—'}</td>
        </tr>)}
      </tbody></table>
    </div>

    {/* Top models */}
    <h4 style={{margin:'0 0 12px',fontSize:14,color:'var(--text-secondary)'}}>Топ моделей по расходам</h4>
    <div className="admin__table-wrapper">
      <table className="admin__table"><thead><tr><th>Модель</th><th>Расходы OR ($)</th></tr></thead><tbody>
        {data.top_models_by_cost?.map((m:any,i:number)=><tr key={i}>
          <td><strong>{m.model}</strong></td>
          <td style={{color:'#e74c3c',fontWeight:600}}>${m.cost.toFixed(4)}</td>
        </tr>)}
        {(!data.top_models_by_cost||data.top_models_by_cost.length===0)&&<tr><td colSpan={2} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет данных</td></tr>}
      </tbody></table>
    </div>

    {/* Export note */}
    <div style={{marginTop:16,fontSize:12,color:'#8e8e9a',background:'var(--bg-card)',padding:12,borderRadius:8}}>
      📊 Данные за последние {days} дней. Выручка, расходы, регистрации и платежи доступны по дням в API аналитики.
    </div>
  </div>;
}

// ══════════════════════════════════

// ══════════════════════════════════
// STAGE 3: Referrals
// ══════════════════════════════════

function ReferralsSection() {
  const [partners,setPartners]=useState<any[]>([]); const [total,setTotal]=useState(0); const [offset,setOffset]=useState(0);
  const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const fetch=useCallback(async()=>{
    setLoading(true);setErr('');
    try {
      const d=await api<any>(`/referrals?limit=50&offset=${offset}`);
      setPartners(d.partners);setTotal(d.total);
    }catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[offset]);
  useEffect(()=>{fetch()},[fetch]);
  const update=async(id:number,field:string,val:any)=>{try{await api(`/referrals/${id}?${field}=${val}`,{method:'PATCH'});fetch()}catch(e:any){setErr(e.message)}};
  const totPages=Math.ceil(total/50);const curPage=Math.floor(offset/50)+1;
  return <div>
    <span className="admin__page-info">Партнёров: {total}</span>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Пользователь</th><th>Код</th><th>Рефералов</th><th>Заработано</th><th>Выплачено</th><th>Комиссия</th><th>Статус</th><th></th></tr></thead><tbody>
      {partners.map((p:any)=><tr key={p.id}>
        <td>{p.user_email}</td>
        <td style={{fontFamily:'monospace',fontSize:12}}>{p.referral_code}</td>
        <td>{p.referral_count}</td>
        <td style={{color:'#00b894',fontWeight:600}}>{(p.total_earned/100).toFixed(2)} ₽</td>
        <td>{(p.total_paid/100).toFixed(2)} ₽</td>
        <td>{Math.round(p.commission_rate*100)}%</td>
        <td><label className="admin__toggle"><input type="checkbox" checked={p.is_active} onChange={()=>update(p.id,'is_active',p.is_active?'false':'true')}/><span className="admin__toggle-slider"></span></label></td>
        <td>{p.recent_transactions?.length>0&&<span className="admin__badge admin__badge--active">{p.recent_transactions[0].type}</span>}</td>
      </tr>)}
      {partners.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет партнёров</td></tr>}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+50>=total} onClick={()=>setOffset(offset+50)}>→</button></div>}
  </div>;
}

// ══════════════════════════════════
// STAGE 3: Forecast
// ══════════════════════════════════

function ForecastSection() {
  const [data,setData]=useState<any>(null); const [days,setDays]=useState(30); const [err,setErr]=useState('');
  useEffect(()=>{api<any>(`/analytics/forecast?days=${days}`).then(setData).catch(e=>setErr(e.message))},[days]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  return <div>
    <div className="admin__row" style={{marginBottom:16}}>
      <span style={{fontSize:13,color:'var(--text-secondary)'}}>На основе данных за:</span>
      <select className="admin__select" value={days} onChange={e=>setDays(Number(e.target.value))}>
        <option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option>
      </select>
    </div>
    <div className="admin__stats" style={{marginBottom:24}}>
      <div className="admin__stat-card"><div className="admin__stat-label">Средний доход/день</div><div className="admin__stat-value" style={{color:'#00b894'}}>{(data.avg_daily_revenue_kop/100).toFixed(2)} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Средние расходы/день</div><div className="admin__stat-value" style={{color:'#e74c3c'}}>{(data.avg_daily_cost_kop/100).toFixed(2)} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Прогноз дохода/мес</div><div className="admin__stat-value" style={{color:'#00b894',fontSize:28}}>{(data.projected_monthly_revenue_kop/100).toFixed(0)} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Прогноз расходов/мес</div><div className="admin__stat-value" style={{color:'#e74c3c'}}>{(data.projected_monthly_cost_kop/100).toFixed(0)} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Рост пользователей</div><div className="admin__stat-value">{data.user_growth_rate_pct}%</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Всего пользователей</div><div className="admin__stat-value" style={{fontSize:24}}>{data.total_users}</div></div>
    </div>
    <div style={{fontSize:12,color:'#8e8e9a',background:'var(--bg-card)',padding:12,borderRadius:8}}>
      📊 Прогноз основан на {data.days_analyzed} днях данных. Фактические значения могут отличаться.
    </div>
  </div>;
}

// ══════════════════════════════════
// STAGE 3: Cohorts
// ══════════════════════════════════

function CohortsSection() {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
  useEffect(()=>{api<any>('/analytics/cohorts').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  return <div>
    <span className="admin__page-info">Всего когорт: {data.total_cohorts}</span>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Неделя</th><th>Пользователей</th><th>Платящих</th><th>Конверсия в оплату</th><th>Выручка</th><th>ARRPU</th></tr></thead><tbody>
      {data.cohorts?.map((c:any,i:number)=><tr key={i}>
        <td style={{fontFamily:'monospace',fontSize:12}}>{c.cohort}</td>
        <td style={{fontWeight:600}}>{c.users}</td>
        <td>{c.paying}</td>
        <td><span className="admin__badge" style={{background:c.users>0&&c.paying/c.users>0.1?'#00b894':'#fdcb6e',color:'#fff'}}>{c.users>0?`${(c.paying/c.users*100).toFixed(1)}%`:'0%'}</span></td>
        <td>{(c.revenue/100).toFixed(2)} ₽</td>
        <td>{c.users>0?`${(c.revenue/c.users/100).toFixed(2)} ₽`:'—'}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ══════════════════════════════════
// SEO Pages
// ══════════════════════════════════

function SeoSection() {
  const [pages,setPages]=useState<any[]>([]); const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [search,setSearch]=useState(''); const [statusFilter,setStatusFilter]=useState('');
  const [typeFilter,setTypeFilter]=useState('');
  const [offset,setOffset]=useState(0); const [showCreate,setShowCreate]=useState(false);
  const [editId,setEditId]=useState<number|null>(null);
  const limit=50;
  const fetch=useCallback(async(q:string,status:string,type:string,off:number)=>{
    setLoading(true);setErr('');
    try{
      const p=new URLSearchParams({limit:String(limit),offset:String(off)});
      if(q)p.set('search',q);if(status)p.set('status',status);if(type)p.set('page_type',type);
      const d=await api<{total:number;pages:any[]}>(`/seo-pages?${p}`);
      setPages(d.pages);setTotal(d.total);
    }catch(e:any){setErr(e.message)}finally{setLoading(false)}
  },[]);
  useEffect(()=>{fetch(search,statusFilter,typeFilter,offset)},[search,statusFilter,typeFilter,offset,fetch]);
  const createPage=async(slug:string,title:string,pageType:string,metaTitle:string)=>{
    await api('/seo-pages',{method:'POST',body:JSON.stringify({slug,title,page_type:pageType,meta_title:metaTitle,status:'published'})});
    setShowCreate(false);fetch(search,statusFilter,typeFilter,offset);
  };
  const deletePage=async(id:number)=>{if(!confirm('Удалить страницу?'))return;await api(`/seo-pages/${id}`,{method:'DELETE'});fetch(search,statusFilter,typeFilter,offset)};
  const toggleStatus=async(p:any)=>{await api(`/seo-pages/${p.id}`,{method:'PATCH',body:JSON.stringify({status:p.status==='published'?'draft':'published'})});fetch(search,statusFilter,typeFilter,offset)};
  const totPages=Math.ceil(total/limit);const curPage=Math.floor(offset/limit)+1;
  return <div>
    <div className="admin__search">
      <input className="admin__search-input" placeholder="Поиск по slug или title..." value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}}/>
      <select className="admin__select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setOffset(0)}} style={{marginLeft:8}}>
        <option value="">Все статусы</option><option value="draft">Draft</option><option value="review">Review</option>
        <option value="published">Published</option><option value="unpublished">Unpublished</option>
      </select>
      <select className="admin__select" value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setOffset(0)}} style={{marginLeft:8}}>
        <option value="">Все типы</option><option value="static">Static</option><option value="prices">Prices</option>
        <option value="models">Models</option><option value="faq">FAQ</option><option value="legal">Legal</option>
        <option value="article">Article</option><option value="main">Main</option>
      </select>
      <button className="admin__btn admin__btn--primary" onClick={()=>setShowCreate(true)} style={{marginLeft:8}}>+ Создать</button>
      <span className="admin__page-info" style={{marginLeft:12}}>Всего: {total}</span>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {loading?<div className="admin__loading">Загрузка...</div>:pages.length===0?<div className="admin__empty">Страницы не найдены</div>:
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr>
      <th>ID</th><th>Slug</th><th>Заголовок</th><th>Тип</th><th>H1</th><th>Статус</th><th>Видимость</th><th>Обновлена</th><th></th>
    </tr></thead><tbody>
      {pages.map(p=><tr key={p.id}>
        <td>{p.id}</td>
        <td style={{fontFamily:'monospace',fontSize:12}}>{p.slug||'/'}</td>
        <td><strong>{p.title}</strong></td>
        <td><span className="admin__badge">{p.page_type}</span></td>
        <td style={{fontSize:12,color:'var(--text-secondary)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.h1||'—'}</td>
        <td><label className="admin__toggle"><input type="checkbox" checked={p.status==='published'} onChange={()=>toggleStatus(p)}/><span className="admin__toggle-slider"></span></label><span style={{fontSize:11,marginLeft:4,color:p.status==='published'?'#00b894':'#8e8e9a'}}>{p.status}</span></td>
        <td>{p.is_visible?'✅':'❌'}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{p.updated_at?new Date(p.updated_at).toLocaleString('ru-RU'):'—'}</td>
        <td>
          <button className="admin__btn admin__btn-sm" onClick={()=>setEditId(p.id)}>✏️</button>
          <button className="admin__btn admin__btn-sm admin__btn--danger" onClick={()=>deletePage(p.id)} style={{marginLeft:4}}>🗑️</button>
        </td>
      </tr>)}
    </tbody></table></div>}
    {totPages>1&&<div className="admin__pagination"><button className="admin__btn admin__btn-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-limit))}>←</button><span className="admin__page-info">{curPage}/{totPages}</span><button className="admin__btn admin__btn-sm" disabled={offset+limit>=total} onClick={()=>setOffset(offset+limit)}>→</button></div>}
    {showCreate&&<SeoCreateModal onClose={()=>setShowCreate(false)} onCreate={createPage} />}
    {editId&&<SeoEditModal pageId={editId} onClose={()=>setEditId(null)} onDone={()=>{setEditId(null);fetch(search,statusFilter,typeFilter,offset)}} />}
  </div>;
}

function SeoCreateModal({onClose,onCreate}:{onClose:()=>void;onCreate:(slug:string,title:string,pageType:string,metaTitle:string)=>void}) {
  const [slug,setSlug]=useState(''); const [title,setTitle]=useState(''); const [pageType,setPageType]=useState('static'); const [metaTitle,setMetaTitle]=useState(''); const [loading,setLoading]=useState(false); const [err,setErr]=useState('');
  const handle=async()=>{if(!slug||!title){setErr('Slug и Title обязательны');return}setLoading(true);setErr('');try{await onCreate(slug,title,pageType,metaTitle||title)}catch(e:any){setErr(e.message)}finally{setLoading(false)}};
  return <div className="admin__modal-overlay" onClick={loading?undefined:onClose}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Новая SEO-страница</h3>
    <div className="admin__modal-field"><label className="admin__modal-label">Slug</label><input className="admin__modal-input" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="contacts"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Заголовок</label><input className="admin__modal-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Контакты"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Meta Title</label><input className="admin__modal-input" value={metaTitle} onChange={e=>setMetaTitle(e.target.value)} placeholder="SEO заголовок"/></div>
    <div className="admin__modal-field"><label className="admin__modal-label">Тип</label><select className="admin__select" value={pageType} onChange={e=>setPageType(e.target.value)} style={{width:'100%'}}>
      <option value="static">Static</option><option value="article">Article</option><option value="faq">FAQ</option>
      <option value="legal">Legal</option><option value="prices">Prices</option><option value="models">Models</option><option value="main">Main</option>
    </select></div>
    {err&&<div className="admin__error">{err}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={loading}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={handle} disabled={loading}>{loading?'...':'Создать'}</button></div>
  </div></div>;
}

function SeoEditModal({pageId,onClose,onDone}:{pageId:number;onClose:()=>void;onDone:()=>void}) {
  const [page,setPage]=useState<any>(null); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);
  const [form,setForm]=useState<Record<string,string>>({}); const [err,setErr]=useState(''); const [success,setSuccess]=useState('');
  const editorRef=useRef<HTMLDivElement>(null); const quillRef=useRef<any>(null);
  // Load Quill from CDN once
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const loaded=document.getElementById('quill-css');
    if(!loaded){
      const link=document.createElement('link');link.id='quill-css';link.rel='stylesheet';
      link.href='https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
      document.head.appendChild(link);
    }
    if(!(window as any).Quill){
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js';
      script.onload=()=>{
        if(editorRef.current&&!quillRef.current){
          const q=new (window as any).Quill(editorRef.current,{theme:'snow',modules:{toolbar:[
            [{header:[1,2,3,false]}],['bold','italic','underline','strike'],
            [{list:'ordered'},{list:'bullet'}],['blockquote','code-block'],
            [{align:[]}],['link','image'],['clean']
          ]}});
          quillRef.current=q;
          if(form.content)q.root.innerHTML=form.content;
        }
      };
      document.body.appendChild(script);
    }else{
      if(editorRef.current&&!quillRef.current){
        const q=new (window as any).Quill(editorRef.current,{theme:'snow',modules:{toolbar:[
          [{header:[1,2,3,false]}],['bold','italic','underline','strike'],
          [{list:'ordered'},{list:'bullet'}],['blockquote','code-block'],
          [{align:[]}],['link','image'],['clean']
        ]}});
        quillRef.current=q;
        if(form.content)q.root.innerHTML=form.content;
      }
    }
  },[page, form.content]);
  useEffect(()=>{
    api<any>(`/seo-pages/${pageId}`).then(p=>{
      setPage(p);setForm({title:p.title||'',h1:p.h1||'',meta_title:p.meta_title||'',meta_description:p.meta_description||'',
        content:p.content||'',subtitle:p.subtitle||'',canonical:p.canonical||'',robots:p.robots||'',author:p.author||''});
    }).catch(e=>setErr(e.message)).finally(()=>setLoading(false));
  },[pageId]);
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{
    setSaving(true);setErr('');setSuccess('');
    try{
      const payload={...form,content:quillRef.current?.root.innerHTML??form.content};
      await api(`/seo-pages/${pageId}`,{method:'PATCH',body:JSON.stringify(payload)});
      setSuccess('Сохранено!');setTimeout(()=>{onDone()},1200);
    }catch(e:any){setErr(e.message)}finally{setSaving(false)}
  };
  if(loading)return<div className="admin__modal-overlay" onClick={onClose}><div className="admin__modal"><div className="admin__loading">Загрузка...</div></div></div>;
  return <div className="admin__modal-overlay" onClick={saving?undefined:onClose}><div className="admin__modal admin__modal--wide" onClick={e=>e.stopPropagation()}>
    <h3 className="admin__modal-title">Редактировать: {page?.slug||'/'}</h3>
    <div className="admin__modal-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxHeight:'60vh',overflowY:'auto',padding:'4px 0'}}>
      <div className="admin__modal-field"><label className="admin__modal-label">Title</label><input className="admin__modal-input" value={form.title} onChange={e=>set('title',e.target.value)}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">H1</label><input className="admin__modal-input" value={form.h1} onChange={e=>set('h1',e.target.value)}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Meta Title</label><input className="admin__modal-input" value={form.meta_title} onChange={e=>set('meta_title',e.target.value)}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Meta Description</label><input className="admin__modal-input" value={form.meta_description} onChange={e=>set('meta_description',e.target.value)}/></div>
      <div className="admin__modal-field" style={{gridColumn:'1/-1'}}><label className="admin__modal-label">Содержание страницы</label>
        <div ref={editorRef} style={{minHeight:300,background:'#fff',color:'#333',borderRadius:6}}>{form.content||''}</div>
      </div>
      <div className="admin__modal-field"><label className="admin__modal-label">Author</label><input className="admin__modal-input" value={form.author} onChange={e=>set('author',e.target.value)}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Subtitle</label><input className="admin__modal-input" value={form.subtitle} onChange={e=>set('subtitle',e.target.value)}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Canonical</label><input className="admin__modal-input" value={form.canonical} onChange={e=>set('canonical',e.target.value)}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Robots</label><input className="admin__modal-input" value={form.robots} onChange={e=>set('robots',e.target.value)} placeholder="index, follow"/></div>
    </div>
    {err&&<div className="admin__error">{err}</div>}
    {success&&<div className="admin__success">{success}</div>}
    <div className="admin__modal-actions"><button className="admin__btn" onClick={onClose} disabled={saving}>Отмена</button><button className="admin__btn admin__btn--primary" onClick={save} disabled={saving}>{saving?'Сохранение...':'Сохранить'}</button></div>
  </div></div>;
}

// ══════════════════════════════════
// STAGE 3: LTV & Retention
// ══════════════════════════════════

function LtvSection() {
  const [ltv,setLtv]=useState<any>(null); const [ret,setRet]=useState<any>(null); const [err,setErr]=useState('');
  useEffect(()=>{
    api<any>('/analytics/ltv').then(setLtv).catch(e=>setErr(e.message));
    api<any>('/analytics/retention').then(setRet).catch(()=>{});
  },[]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!ltv)return<div className="admin__loading">Загрузка...</div>;
  return <div>
    <h4 style={{margin:'0 0 12px',fontSize:14,color:'var(--text-secondary)'}}>LTV (Lifetime Value)</h4>
    <div className="admin__stats" style={{marginBottom:24}}>
      <div className="admin__stat-card"><div className="admin__stat-label">Средний LTV</div><div className="admin__stat-value" style={{color:'#00b894',fontSize:28}}>{(ltv.avg_ltv_kop/100).toFixed(2)} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Средний чек</div><div className="admin__stat-value">{(ltv.avg_order_kop/100).toFixed(2)} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Платящих юзеров</div><div className="admin__stat-value">{ltv.paying_users}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Повторные покупки</div><div className="admin__stat-value">{ltv.repeat_payers}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Repeat rate</div><div className="admin__stat-value" style={{color:'#6c5ce7'}}>{ltv.repeat_purchase_rate_pct}%</div></div>
    </div>

    {ret&&<>
      <h4 style={{margin:'0 0 12px',fontSize:14,color:'var(--text-secondary)'}}>Retention (удержание)</h4>
      <div className="admin__stats">
        <div className="admin__stat-card"><div className="admin__stat-label">D+1</div><div className="admin__stat-value" style={{color:'#00b894',fontSize:28}}>{ret.retention?.d1?.rate||0}%</div><div className="admin__stat-label" style={{fontSize:11}}>{ret.retention?.d1?.count||0} пользователей</div></div>
        <div className="admin__stat-card"><div className="admin__stat-label">D+7</div><div className="admin__stat-value" style={{color:'#fdcb6e',fontSize:28}}>{ret.retention?.d7?.rate||0}%</div><div className="admin__stat-label" style={{fontSize:11}}>{ret.retention?.d7?.count||0} пользователей</div></div>
        <div className="admin__stat-card"><div className="admin__stat-label">D+30</div><div className="admin__stat-value" style={{color:'#e17055',fontSize:28}}>{ret.retention?.d30?.rate||0}%</div><div className="admin__stat-label" style={{fontSize:11}}>{ret.retention?.d30?.count||0} пользователей</div></div>
      </div>
      <div style={{fontSize:12,color:'#8e8e9a',marginTop:8}}>Проанализировано пользователей: {ret.total_users_analyzed}</div>
    </>}
  </div>;
}

// ══════════════════════════════════════════════════════════════
// New Product Analytics Sections
// ══════════════════════════════════════════════════════════════

// ── 1. Funnel ──

function FunnelSection() {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
  useEffect(()=>{api<any>('/analytics/funnel').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  const f=data.funnel||[];
  const s=data.summary||{};
  return <div>
    <div className="admin__stats" style={{marginBottom:24}}>
      <div className="admin__stat-card"><div className="admin__stat-label">Всего юзеров</div><div className="admin__stat-value">{s.total_users}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Платящие</div><div className="admin__stat-value" style={{color:'#00b894'}}>{s.paying_users}</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Конверсия</div><div className="admin__stat-value" style={{color:'#6c5ce7'}}>{s.overall_conversion_pct||0}%</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Выручка</div><div className="admin__stat-value" style={{color:'#00b894'}}>{s.total_revenue_rub?.toLocaleString('ru-RU')||0} ₽</div></div>
      <div className="admin__stat-card"><div className="admin__stat-label">Средний чек</div><div className="admin__stat-value">{s.avg_revenue_per_payer_rub||0} ₽</div></div>
    </div>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Этап</th><th>Пользователей</th><th>Конверсия</th><th>Отвалилось</th></tr></thead><tbody>
      {f.map((st:any,i:number)=><tr key={i}>
        <td><strong>{st.stage}</strong></td>
        <td>{st.count}</td>
        <td><div className="admin__progress-bar" style={{display:'flex',alignItems:'center',gap:8}}><div style={{flex:1,height:8,background:'#eee',borderRadius:4,overflow:'hidden'}}><div style={{width:`${Math.min(st.conversion||0,100)}%`,height:'100%',background:st.conversion<20?'#e74c3c':st.conversion<50?'#fdcb6e':'#00b894',borderRadius:4,transition:'width 0.3s'}}/></div><span style={{fontSize:12,fontWeight:600,color:st.conversion<20?'#e74c3c':st.conversion<50?'#e17055':'#00b894',minWidth:45}}>{st.conversion}%</span></div></td>
        <td style={{color:'#e74c3c'}}>{st.dropped>0?`-${st.dropped}`:'—'}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ── 2. Problems (product issues) ──

function ProblemsSection() {
  const [data,setData]=useState<any[]>([]); const [err,setErr]=useState('');
  useEffect(()=>{api<any[]>('/analytics/problems').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  return <div>
    <p style={{fontSize:13,color:'#8e8e9a',marginBottom:12}}>Проблемы продукта за последние 30 дней</p>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Проблема</th><th>Пользователей</th><th>Потерянная выручка</th><th>Приоритет</th></tr></thead><tbody>
      {data.length===0?<tr><td colSpan={4} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет данных</td></tr>:
      data.map((p:any,i:number)=><tr key={i}>
        <td>{p.problem}</td>
        <td>{p.users_count}</td>
        <td style={{color:'#e74c3c'}}>{p.lost_revenue>0?`${p.lost_revenue.toLocaleString('ru-RU')} ₽`:'—'}</td>
        <td><span className={`admin__badge ${p.priority==='high'?'admin__badge--blocked':'admin__badge--active'}`}>{p.priority==='high'?'Высокий':'Средний'}</span></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ── 3. User Segments ──

function SegmentsSection() {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState(''); const [expanded,setExpanded]=useState<string|null>(null);
  useEffect(()=>{api<any>('/analytics/user-segments').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  const segLabels:Record<string,string>={inactive:'Неактивные',new:'Новые',activated:'Активировались',interested:'Заинтересованные',almost_buying:'Почти купят',active_free:'Активные бесплатные',paying:'Платящие',vip:'VIP'};
  const segColors:Record<string,string>={inactive:'#8e8e9a',new:'#6c5ce7',activated:'#0984e3',interested:'#fdcb6e',almost_buying:'#e17055',active_free:'#00cec9',paying:'#00b894',vip:'#e74c3c'};
  return <div>
    <div className="admin__stats" style={{marginBottom:24}}>
      {Object.entries(data).map(([k,v]:[string,any])=><div key={k} className="admin__stat-card" style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===k?null:k)}>
        <div className="admin__stat-label">{segLabels[k]||k}</div>
        <div className="admin__stat-value" style={{color:segColors[k]||'var(--accent)'}}>{v.count}</div>
        <div style={{fontSize:11,color:'#8e8e9a'}}>пользователей</div>
      </div>)}
    </div>
    {expanded&&data[expanded]&&<div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>ID</th><th>Email</th><th>Кредиты</th><th>Запросов</th><th>Потрачено</th><th>Последний визит</th></tr></thead><tbody>
      {(data[expanded].users||[]).map((u:any)=><tr key={u.id}><td>{u.id}</td><td>{u.email}</td><td>{u.credits}</td><td>{u.request_count}</td><td>{u.total_paid_rub} ₽</td><td style={{fontSize:12,color:'#8e8e9a'}}>{u.last_seen?new Date(u.last_seen).toLocaleString('ru-RU'):'никогда'}</td></tr>)}
    </tbody></table></div>}
  </div>;
}

// ── 4. Request Categories ──

function CategoriesSection() {
  const [data,setData]=useState<any[]>([]); const [err,setErr]=useState('');
  useEffect(()=>{api<any[]>('/analytics/request-categories').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  return <div>
    <p style={{fontSize:13,color:'#8e8e9a',marginBottom:12}}>Распределение запросов по категориям (последние 500 сообщений)</p>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Категория</th><th>Запросов</th><th>Доля</th><th>Платят</th><th>Средний чек</th><th>Потенциал</th></tr></thead><tbody>
      {data.length===0?<tr><td colSpan={6} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет данных</td></tr>:
      data.map((c:any,i:number)=><tr key={i}>
        <td><strong>{c.category}</strong></td>
        <td>{c.count}</td>
        <td>{c.share_pct}%</td>
        <td>{c.paying_users}</td>
        <td>{c.avg_cheque} ₽</td>
        <td><span className={`admin__badge ${c.potential==='high'?'admin__badge--admin':c.potential==='medium'?'admin__badge--active':'admin__badge--blocked'}`}>{c.potential==='high'?'Высокий':c.potential==='medium'?'Средний':'Низкий'}</span></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ── 5. Model Analytics ──

function ModelAnalyticsSection() {
  const [data,setData]=useState<any[]>([]); const [err,setErr]=useState('');
  useEffect(()=>{api<any[]>('/analytics/models-feedback').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  return <div>
    <p style={{fontSize:13,color:'#8e8e9a',marginBottom:12}}>Аналитика по моделям на основе оценок пользователей</p>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Модель</th><th>Оценок</th><th>Средняя оценка</th></tr></thead><tbody>
      {data.length===0?<tr><td colSpan={3} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет данных по фидбеку</td></tr>:
      data.map((m:any,i:number)=><tr key={i}>
        <td><strong>{m.model_name}</strong></td>
        <td>{m.feedback_count}</td>
        <td><span style={{color:m.avg_rating>=4?'#00b894':m.avg_rating>=3?'#fdcb6e':'#e74c3c',fontWeight:600}}>{m.avg_rating}</span></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ── 6. Abandoned Payments ──

function AbandonedSection() {
  const [data,setData]=useState<any[]>([]); const [err,setErr]=useState('');
  useEffect(()=>{api<any[]>('/payments/abandoned?limit=50').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  return <div>
    <p style={{fontSize:13,color:'#8e8e9a',marginBottom:12}}>Платежи, которые были начаты, но не завершены</p>
    <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Пользователь</th><th>Сумма</th><th>Кредиты</th><th>Статус</th><th>Ошибка</th><th>Дата</th></tr></thead><tbody>
      {data.length===0?<tr><td colSpan={6} style={{textAlign:'center',color:'#8e8e9a',padding:24}}>Нет брошенных оплат</td></tr>:
      data.map((p:any,i:number)=><tr key={i}>
        <td>{p.user_email}</td>
        <td style={{fontWeight:600}}>{p.amount_rub} ₽</td>
        <td>{p.credits}</td>
        <td><span className={`admin__badge ${p.status==='pending'?'admin__badge--active':'admin__badge--blocked'}`}>{p.status==='pending'?'Ожидает':'Ошибка'}</span></td>
        <td style={{fontSize:12,color:'#e74c3c'}}>{p.error||'—'}</td>
        <td style={{fontSize:12,color:'#8e8e9a'}}>{p.created_at?new Date(p.created_at).toLocaleString('ru-RU'):'—'}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

// ── 7. Survey Results ──

function SurveysSection() {
  const [data,setData]=useState<any>(null); const [err,setErr]=useState('');
  useEffect(()=>{api<any>('/surveys/results').then(setData).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  if(!data)return<div className="admin__loading">Загрузка...</div>;
  const keys=Object.keys(data);
  if(keys.length===0)return<div className="admin__empty">Нет ответов на опросы</div>;
  return <div>
    {keys.map((st:string)=><div key={st} style={{marginBottom:24}}>
      <h4 style={{margin:'0 0 8px',fontSize:14,color:'var(--text-secondary)'}}>{st}</h4>
      <div className="admin__table-wrapper"><table className="admin__table"><thead><tr><th>Ответ</th><th>Количество</th><th>Доля</th></tr></thead><tbody>
        {(data[st]||[]).map((r:any,i:number)=><tr key={i}>
          <td>{r.answer}</td>
          <td>{r.count}</td>
          <td>{r.share_pct}%</td>
        </tr>)}
      </tbody></table></div>
    </div>)}
  </div>;
}

// ── 8. Triggers ──

function TriggersSection() {
  const [triggers,setTriggers]=useState<any[]>([]); const [err,setErr]=useState('');
  const [editing,setEditing]=useState<any|null>(null);
  useEffect(()=>{api<any[]>('/triggers').then(setTriggers).catch(e=>setErr(e.message))},[]);
  if(err)return<div className="admin__error">{err}</div>;
  const toggleActive=async(t:any)=>{try{await api(`/triggers/${t.id}`,{method:'PUT',body:JSON.stringify({is_active:!t.is_active})});setTriggers(triggers.map(x=>x.id===t.id?{...x,is_active:!x.is_active}:x))}catch(e:any){setErr(e.message)}};
  const del=async(id:number)=>{if(!confirm('Удалить триггер?'))return;try{await api(`/triggers/${id}`,{method:'DELETE'});setTriggers(triggers.filter(x=>x.id!==id))}catch(e:any){setErr(e.message)}};
  return <div>
    <div className="admin__section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <p style={{fontSize:13,color:'#8e8e9a',margin:0}}>Автоматические предложения на основе поведения</p>
      <button className="admin__btn admin__btn--primary admin__btn-sm" onClick={()=>setEditing({name:'',action_type:'banner',action_config:{title:'',text:'',button_text:''},conditions:{event_type:'message_sent',min_count:2},priority:100,is_active:true,is_once:true})}>+ Новый триггер</button>
    </div>
    {triggers.length===0 && !editing && <div className="admin__empty">Нет триггеров. Создайте первый.</div>}
    {triggers.map((t:any)=><div key={t.id} className="admin__card admin__stack-card" style={{padding:12,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',opacity:t.is_active?1:0.5}}>
      <div><strong>{t.name}</strong><div style={{fontSize:12,color:'#8e8e9a'}}>{t.action_type} · приоритет {t.priority}{t.user_segment?` · сегмент: ${t.user_segment}`:''}</div></div>
      <div style={{display:'flex',gap:8}}>
        <button className="admin__btn admin__btn-sm" onClick={()=>setEditing(t)}>✏️</button>
        <button className={`admin__btn admin__btn-sm ${t.is_active?'admin__btn--danger':''}`} onClick={()=>toggleActive(t)}>{t.is_active?'🔇':'🔊'}</button>
        <button className="admin__btn admin__btn-sm admin__btn--danger" onClick={()=>del(t.id)}>🗑️</button>
      </div>
    </div>)}
    {editing&&<div className="admin__modal-overlay" onClick={()=>setEditing(null)}><div className="admin__modal" onClick={e=>e.stopPropagation()}>
      <h3 className="admin__modal-title">{editing.id?'Редактировать':'Новый'} триггер</h3>
      <div className="admin__modal-field"><label className="admin__modal-label">Название</label><input className="admin__modal-input" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="Например: первый запрос без оплаты"/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Тип действия</label><select className="admin__select" style={{width:'100%'}} value={editing.action_type} onChange={e=>setEditing({...editing,action_type:e.target.value})}><option value="banner">Баннер</option><option value="popup">Попап</option><option value="notification">Уведомление</option></select></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Приоритет</label><input className="admin__modal-input" type="number" value={editing.priority} onChange={e=>setEditing({...editing,priority:parseInt(e.target.value)||100})}/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Условие: событие</label><input className="admin__modal-input" value={editing.conditions?.event_type||''} onChange={e=>setEditing({...editing,conditions:{...editing.conditions,event_type:e.target.value}})} placeholder="message_sent"/></div>
      <div className="admin__modal-field"><label className="admin__modal-label">Мин. количество</label><input className="admin__modal-input" type="number" value={editing.conditions?.min_count||''} onChange={e=>setEditing({...editing,conditions:{...editing.conditions,min_count:parseInt(e.target.value)||1}})}/></div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <label><input type="checkbox" checked={editing.is_once} onChange={e=>setEditing({...editing,is_once:e.target.checked})}/> Срабатывает один раз</label>
        <label><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing({...editing,is_active:e.target.checked})}/> Активен</label>
      </div>
      <div className="admin__modal-actions">
        <button className="admin__btn" onClick={()=>setEditing(null)}>Отмена</button>
        <button className="admin__btn admin__btn--primary" onClick={async()=>{
          try{
            if(editing.id){await api(`/triggers/${editing.id}`,{method:'PUT',body:JSON.stringify(editing)})}
            else{await api('/triggers',{method:'POST',body:JSON.stringify(editing)})}
            setEditing(null);const d=await api<any[]>('/triggers');setTriggers(d);
          }catch(e:any){setErr(e.message)}
        }}>{editing.id?'Сохранить':'Создать'}</button>
      </div>
      {err&&<div className="admin__error">{err}</div>}
    </div></div>}
  </div>;
}
