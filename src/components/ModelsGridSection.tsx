export default function ModelsGridSection() {
  const providers = [
    { name: 'OpenAI', color: '#10a37f', models: ['GPT-5', 'GPT-5.4', 'GPT-4o', 'o3'] },
    { name: 'Anthropic', color: '#d97706', models: ['Claude Opus', 'Claude Sonnet', 'Claude Haiku'] },
    { name: 'Google', color: '#4285f4', models: ['Gemini Pro', 'Gemini Flash', 'Gemma'] },
    { name: 'DeepSeek', color: '#4f46e5', models: ['DeepSeek V4', 'DeepSeek V3'] },
    { name: 'Mistral', color: '#f97316', models: ['Mistral Large', 'Mistral Small'] },
    { name: 'Qwen', color: '#06b6d4', models: ['Qwen3.7', 'Qwen3.5', 'Qwen VL'] },
    { name: 'xAI', color: '#1d1d1f', models: ['Grok 4', 'Grok Build'] },
    { name: 'Perplexity', color: '#22c55e', models: ['Sonar Pro', 'Sonar Reasoning'] },
    { name: 'Amazon', color: '#ff9900', models: ['Nova 2', 'Nova Premier'] },
    { name: 'Microsoft', color: '#00a4ef', models: ['Phi 4 Mini'] },
    { name: 'NVIDIA', color: '#76b900', models: ['Nemotron 3', 'Llama Nemotron'] },
    { name: 'Xiaomi', color: '#ff6900', models: ['MiMo V2.5'] },
    { name: 'Z.ai', color: '#8b5cf6', models: ['GLM 5', 'GLM 4'] },
  ];
  return (
    <section className="models-grid">
      <h2 className="models-grid__title">Какие модели доступны</h2>
      <p className="models-grid__subtitle">Более 100 моделей от ведущих мировых провайдеров</p>
      <div className="models-grid__list anim-stagger">
        {providers.map((p, i) => (
          <div key={i} className="models-grid__item">
            <span className="models-grid__item-icon" style={{ color: p.color }}>◆</span>
            {p.name}
          </div>
        ))}
      </div>
    </section>
  );
}
