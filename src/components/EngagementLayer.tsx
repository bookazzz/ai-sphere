'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  answerSurvey, campaignAction, fetchCampaigns, fetchSurveys, recordProductEvent,
} from '@/lib/api';
import type { EngagementCampaign, EngagementSurvey } from '@/lib/api';

export default function EngagementLayer() {
  const [campaigns, setCampaigns] = useState<EngagementCampaign[]>([]);
  const [survey, setSurvey] = useState<EngagementSurvey | null>(null);
  const [answer, setAnswer] = useState('');
  const [messagesOpen, setMessagesOpen] = useState(false);

  const loadCampaigns = useCallback(() => {
    fetchCampaigns().then(items => {
      setCampaigns(items);
      items.forEach(item => {
        const key = `ai_sphere_campaign_shown_${item.delivery_id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          void campaignAction(item.delivery_id, 'shown');
          void recordProductEvent({ event_name: 'campaign_shown', metadata: { campaign_id: item.id, delivery_id: item.delivery_id } });
        }
      });
    }).catch(() => undefined);
  }, []);

  const loadSurvey = useCallback((trigger: string) => {
    if (!trigger) return;
    fetchSurveys(trigger).then(items => {
      if (items[0]) {
        setSurvey(items[0]);
        void recordProductEvent({ event_name: 'survey_shown', metadata: { survey_id: items[0].id } });
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadCampaigns();
    const handler = (event: Event) => {
      const name = (event as CustomEvent<{ event_name?: string }>).detail?.event_name || '';
      // The successful completion is authoritative on the server, while the
      // browser emits `first_result` only as a UI signal for opening the survey.
      if (name === 'first_result') loadSurvey('result_success');
      else if (['generation_failed', 'result_reused', 'payment_returned'].includes(name)) loadSurvey(name);
    };
    window.addEventListener('ai-sphere-product-event', handler);
    return () => window.removeEventListener('ai-sphere-product-event', handler);
  }, [loadCampaigns, loadSurvey]);

  const dismiss = (item: EngagementCampaign) => {
    setCampaigns(current => current.filter(value => value.delivery_id !== item.delivery_id));
    void campaignAction(item.delivery_id, 'dismissed');
    void recordProductEvent({ event_name: 'campaign_dismissed', metadata: { campaign_id: item.id, delivery_id: item.delivery_id } });
  };
  const open = (item: EngagementCampaign) => {
    void campaignAction(item.delivery_id, 'clicked');
    void recordProductEvent({ event_name: 'campaign_clicked', metadata: { campaign_id: item.id, delivery_id: item.delivery_id } });
    if (item.button_url) window.location.assign(item.button_url);
  };

  const visible = campaigns.filter(item => item.placement !== 'notification');
  const notifications = campaigns.filter(item => item.placement === 'notification');
  const active = visible[0];
  const question = survey?.questions[0];

  return <>
    {active && <aside className={`engagement engagement--${active.placement}`} role="status">
      <button className="engagement__close" onClick={() => dismiss(active)} aria-label="Закрыть">×</button>
      <strong>{active.title}</strong><p>{active.body}</p>
      {active.button_text && <button className="engagement__cta" onClick={() => open(active)}>{active.button_text}</button>}
    </aside>}

    {notifications.length > 0 && <div className="message-center">
      <button className="message-center__button" onClick={() => { setMessagesOpen(value => !value); notifications.forEach(item => void campaignAction(item.delivery_id,'opened')); }} aria-label="Центр сообщений">🔔<span>{notifications.length}</span></button>
      {messagesOpen && <div className="message-center__panel">{notifications.map(item => <article key={item.delivery_id}>
        <button onClick={() => dismiss(item)}>×</button><strong>{item.title}</strong><p>{item.body}</p>
        {item.button_text && <a onClick={() => open(item)}>{item.button_text}</a>}
      </article>)}</div>}
    </div>}

    {survey && question && <div className="engagement-survey" role="dialog" aria-modal="true">
      <div className="engagement-survey__card">
        <button className="engagement__close" onClick={() => setSurvey(null)}>×</button>
        <h3>{survey.title}</h3><p>{question.prompt}</p>
        {question.options.length > 0 ? <div className="engagement-survey__options">{question.options.map(option => <button key={option} onClick={() => setAnswer(option)} className={answer === option ? 'is-selected' : ''}>{option}</button>)}</div> : <textarea value={answer} onChange={event => setAnswer(event.target.value)} />}
        <button className="engagement__cta" disabled={!answer.trim()} onClick={async () => {
          await answerSurvey(survey.id, question.id, answer);
          void recordProductEvent({ event_name: 'survey_answered', metadata: { survey_id: survey.id, question_id: question.id } });
          setSurvey(null); setAnswer('');
        }}>Отправить</button>
      </div>
    </div>}
  </>;
}
