'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  createSupportTicket, fetchSupportTicket, fetchSupportTickets, replySupportTicket,
  type SupportTicketDetail, type SupportTicketSummary,
} from '@/lib/api';

const CATEGORIES: Record<string, string> = {
  general: 'Общий вопрос', billing: 'Оплата и тарифы', technical: 'Техническая проблема',
  feature: 'Предложение', bug: 'Ошибка', other: 'Другое',
};
const STATUS: Record<string, string> = {
  new: 'Новое', in_progress: 'В работе', waiting_user: 'Ждёт ответа', resolved: 'Решено', closed: 'Закрыто',
};

interface Props { isOpen: boolean; onClose: () => void; onSuccess?: () => void }

export default function TicketModal({ isOpen, onClose, onSuccess }: Props) {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [active, setActive] = useState<SupportTicketDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setTickets(await fetchSupportTickets()); } catch (err: any) { setError(err.message); }
  }, []);
  useEffect(() => { if (isOpen) void load(); }, [isOpen, load]);
  if (!isOpen) return null;

  const openTicket = async (id: number) => {
    setError(''); setBusy(true);
    try { setActive(await fetchSupportTicket(id)); } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };
  const submitNew = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await createSupportTicket({ subject: subject.trim(), category, priority, message: message.trim() });
      setSubject(''); setMessage(''); setCreating(false); await load(); await openTicket(result.ticket_id); onSuccess?.();
    } catch (err: any) { setError(err.message || 'Не удалось отправить обращение'); }
    finally { setBusy(false); }
  };
  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !message.trim()) return;
    setBusy(true); setError('');
    try { await replySupportTicket(active.id, message.trim()); setMessage(''); await openTicket(active.id); await load(); }
    catch (err: any) { setError(err.message || 'Не удалось отправить сообщение'); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal modal--ticket" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        <h2 className="modal__title">Техподдержка</h2>
        {error && <div className="modal__error">{error}</div>}

        {active ? <>
          <button type="button" className="modal__btn modal__btn--secondary" onClick={() => { setActive(null); setMessage(''); }}>← Все обращения</button>
          <h3>{active.subject}</h3><p>{STATUS[active.status] || active.status}</p>
          <div aria-live="polite" style={{ maxHeight: 280, overflowY: 'auto', display: 'grid', gap: 8 }}>
            {active.messages.map(item => <div key={item.id} className="modal__field"><p>{item.content}</p><small>{item.created_at ? new Date(item.created_at).toLocaleString('ru-RU') : ''}</small></div>)}
          </div>
          {!['resolved', 'closed'].includes(active.status) && <form onSubmit={submitReply} className="modal__form">
            <textarea className="modal__textarea" value={message} onChange={e => setMessage(e.target.value)} rows={3} required placeholder="Ваш ответ" />
            <button className="modal__btn modal__btn--primary" disabled={busy || !message.trim()}>Отправить</button>
          </form>}
        </> : creating ? <form onSubmit={submitNew} className="modal__form">
          <input className="modal__input" value={subject} onChange={e => setSubject(e.target.value)} maxLength={255} required placeholder="Тема" />
          <div className="modal__field-row"><select className="modal__select" value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select className="modal__select" value={priority} onChange={e => setPriority(e.target.value)}><option value="low">Низкий</option><option value="normal">Средний</option><option value="high">Высокий</option><option value="urgent">Срочный</option></select></div>
          <textarea className="modal__textarea" value={message} onChange={e => setMessage(e.target.value)} rows={5} required placeholder="Опишите проблему" />
          <div className="modal__actions"><button className="modal__btn modal__btn--primary" disabled={busy || !subject.trim() || !message.trim()}>Отправить</button><button type="button" className="modal__btn modal__btn--secondary" onClick={() => setCreating(false)}>Назад</button></div>
        </form> : <>
          <button className="modal__btn modal__btn--primary" onClick={() => setCreating(true)}>Новое обращение</button>
          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            {tickets.map(ticket => <button key={ticket.id} className="modal__btn modal__btn--secondary" onClick={() => void openTicket(ticket.id)}><strong>{ticket.subject}</strong> · {STATUS[ticket.status] || ticket.status}</button>)}
            {!tickets.length && !busy && <p>Обращений пока нет.</p>}
          </div>
        </>}
      </div>
    </div>
  );
}
