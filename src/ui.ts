export const UI_HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>jevBrowser</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0d10;
      --panel: #12161b;
      --panel-2: #171c22;
      --border: #2a313a;
      --text: #eef2f7;
      --muted: #96a0ad;
      --accent: #7dd3fc;
      --accent-2: #38bdf8;
      --success: #86efac;
      --warn: #fde68a;
      --danger: #fca5a5;
      --radius: 14px;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at top, #15202b 0, var(--bg) 38%);
      color: var(--text);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      width: min(1180px, calc(100% - 32px));
      margin: 36px auto 64px;
    }

    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
    }

    h1 { margin: 0; font-size: 30px; letter-spacing: -0.04em; }
    h2 { margin: 0 0 14px; font-size: 16px; }
    p { margin: 6px 0 0; color: var(--muted); }

    .health {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 7px 11px;
      color: var(--muted);
      background: rgba(18, 22, 27, 0.75);
      white-space: nowrap;
    }

    .dot { width: 8px; height: 8px; border-radius: 50%; background: #64748b; }
    .health.ok .dot { background: var(--success); box-shadow: 0 0 12px rgba(134, 239, 172, .45); }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(380px, .95fr);
      gap: 18px;
      align-items: start;
    }

    .card {
      background: rgba(18, 22, 27, 0.92);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 14px 45px rgba(0,0,0,.24);
      overflow: hidden;
    }

    .card-body { padding: 20px; }
    .stack { display: grid; gap: 14px; }
    label { display: grid; gap: 7px; font-weight: 650; }
    .hint { font-weight: 400; color: var(--muted); font-size: 12px; }

    input, textarea {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #0d1116;
      color: var(--text);
      padding: 11px 12px;
      outline: none;
      font: inherit;
      transition: border-color .15s, box-shadow .15s;
    }

    input:focus, textarea:focus {
      border-color: var(--accent-2);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, .11);
    }

    textarea { min-height: 116px; resize: vertical; }
    #variables { min-height: 84px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    .row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 14px;
    }

    .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      color: var(--muted);
    }

    .check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      cursor: pointer;
    }

    .check input { width: auto; accent-color: var(--accent-2); }

    button {
      appearance: none;
      border: 0;
      border-radius: 10px;
      background: var(--accent-2);
      color: #04131a;
      font-weight: 800;
      padding: 11px 16px;
      cursor: pointer;
      transition: transform .08s, opacity .15s;
    }

    button:hover { transform: translateY(-1px); }
    button:disabled { opacity: .55; cursor: wait; transform: none; }

    .actions { display: flex; align-items: center; gap: 12px; }
    .running { color: var(--muted); display: none; }
    .running.visible { display: inline; }

    .result-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      background: rgba(23, 28, 34, .76);
    }

    .pill {
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 800;
      background: #25303b;
      color: var(--muted);
    }
    .pill.completed { background: rgba(34,197,94,.12); color: var(--success); }
    .pill.blocked, .pill.requires_confirmation, .pill.max_steps { background: rgba(234,179,8,.12); color: var(--warn); }
    .pill.failed { background: rgba(239,68,68,.12); color: var(--danger); }

    .empty {
      min-height: 280px;
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--muted);
      padding: 28px;
    }

    .summary { display: grid; gap: 10px; }
    .summary strong { color: var(--text); }
    .summary a { color: var(--accent); word-break: break-all; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; border-bottom: 1px solid var(--border); padding: 9px 8px; vertical-align: top; }
    th { color: var(--muted); font-weight: 700; }
    td:first-child, th:first-child { padding-left: 0; }
    td:last-child, th:last-child { padding-right: 0; }

    .section { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); }
    pre {
      margin: 0;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #0a0d11;
      padding: 12px;
      max-height: 330px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      color: #cbd5e1;
      font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .error { color: var(--danger); white-space: pre-wrap; }

    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; }
      header { flex-direction: column; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>jevBrowser</h1>
        <p>TypeSafe AI decide. Playwright executa.</p>
      </div>
      <div id="health" class="health"><span class="dot"></span><span>verificando servidor</span></div>
    </header>

    <div class="grid">
      <section class="card">
        <div class="card-body">
          <h2>Nova tarefa</h2>
          <form id="task-form" class="stack">
            <label>
              URL inicial
              <input id="url" name="url" type="url" required value="https://www.google.com/travel/flights" placeholder="https://example.com" />
            </label>

            <label>
              Tarefa
              <textarea id="task" name="task" required placeholder="Ex.: procure o preço de uma passagem de São Paulo para Lisboa..."></textarea>
            </label>

            <div class="row">
              <label>
                Máx. passos
                <input id="maxSteps" name="maxSteps" type="number" min="1" max="100" value="20" />
              </label>

              <label>
                Variáveis opcionais
                <textarea id="variables" name="variables" spellcheck="false" placeholder="email=voce@example.com&#10;senha=...&#10;nome=Felipe"></textarea>
                <span class="hint">Uma por linha no formato chave=valor. O valor fica local no executor.</span>
              </label>
            </div>

            <div class="checks">
              <label class="check"><input id="headed" type="checkbox" /> mostrar navegador</label>
              <label class="check"><input id="allowDangerous" type="checkbox" /> permitir ações de alto impacto</label>
            </div>

            <div class="actions">
              <button id="run-button" type="submit">Executar tarefa</button>
              <span id="running" class="running">Executando…</span>
            </div>
          </form>
        </div>
      </section>

      <section class="card" id="result-card">
        <div class="result-head">
          <strong>Resultado</strong>
          <span id="status" class="pill">aguardando</span>
        </div>
        <div id="result" class="empty">Preencha a tarefa e clique em <strong>Executar tarefa</strong>.</div>
      </section>
    </div>
  </main>

  <script>
    const form = document.getElementById('task-form');
    const runButton = document.getElementById('run-button');
    const running = document.getElementById('running');
    const result = document.getElementById('result');
    const status = document.getElementById('status');
    const health = document.getElementById('health');

    void checkHealth();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setRunning(true);
      setStatus('running');
      result.className = 'card-body';
      clear(result);
      appendText(result, 'Executando a tarefa. O resultado aparecerá aqui quando o agente terminar.', 'p');

      const payload = {
        url: document.getElementById('url').value.trim(),
        task: document.getElementById('task').value.trim(),
        maxSteps: Number(document.getElementById('maxSteps').value || 20),
        headless: !document.getElementById('headed').checked,
        allowDangerous: document.getElementById('allowDangerous').checked,
      };

      const variables = parseVariables(document.getElementById('variables').value);
      if (Object.keys(variables).length) payload.variables = variables;

      try {
        const response = await fetch('/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
        if (!response.ok && !body.status) throw new Error(body.error || ('HTTP ' + response.status));
        renderResult(body);
      } catch (error) {
        setStatus('failed');
        clear(result);
        const message = document.createElement('div');
        message.className = 'error';
        message.textContent = error instanceof Error ? error.message : String(error);
        result.appendChild(message);
      } finally {
        setRunning(false);
      }
    });

    async function checkHealth() {
      try {
        const response = await fetch('/health', { cache: 'no-store' });
        if (!response.ok) throw new Error('offline');
        health.classList.add('ok');
        health.querySelector('span:last-child').textContent = 'servidor online';
      } catch {
        health.classList.remove('ok');
        health.querySelector('span:last-child').textContent = 'servidor indisponível';
      }
    }

    function parseVariables(text) {
      const output = {};
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const separator = line.indexOf('=');
        if (separator < 1) continue;
        output[line.slice(0, separator).trim()] = line.slice(separator + 1);
      }
      return output;
    }

    function renderResult(data) {
      setStatus(data.status || 'unknown');
      result.className = 'card-body';
      clear(result);

      const summary = document.createElement('div');
      summary.className = 'summary';
      addSummary(summary, 'Mensagem', data.message || '—');
      addSummary(summary, 'Título final', data.finalTitle || '—');

      const urlRow = document.createElement('div');
      const urlLabel = document.createElement('strong');
      urlLabel.textContent = 'URL final: ';
      const url = document.createElement('a');
      url.href = data.finalUrl || '#';
      url.target = '_blank';
      url.rel = 'noreferrer';
      url.textContent = data.finalUrl || '—';
      urlRow.append(urlLabel, url);
      summary.appendChild(urlRow);
      result.appendChild(summary);

      if (Array.isArray(data.steps) && data.steps.length) {
        const section = document.createElement('div');
        section.className = 'section';
        const heading = document.createElement('h2');
        heading.textContent = 'Passos (' + data.steps.length + ')';
        section.appendChild(heading);

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const label of ['#', 'Ação', 'Alvo', 'Conf.', 'Nota']) {
          const th = document.createElement('th');
          th.textContent = label;
          headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const step of data.steps) {
          const tr = document.createElement('tr');
          const values = [
            step.step,
            step.action || '—',
            step.target || '—',
            typeof step.actionConfidence === 'number' ? step.actionConfidence.toFixed(2) : '—',
            step.note || '—',
          ];
          for (const value of values) {
            const td = document.createElement('td');
            td.textContent = String(value ?? '—');
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        section.appendChild(table);
        result.appendChild(section);
      }

      if (data.finalText) {
        const section = document.createElement('div');
        section.className = 'section';
        const heading = document.createElement('h2');
        heading.textContent = 'Texto final da página';
        const pre = document.createElement('pre');
        pre.textContent = data.finalText;
        section.append(heading, pre);
        result.appendChild(section);
      }

      const rawSection = document.createElement('details');
      rawSection.className = 'section';
      const summaryEl = document.createElement('summary');
      summaryEl.textContent = 'JSON completo';
      summaryEl.style.cursor = 'pointer';
      const pre = document.createElement('pre');
      pre.style.marginTop = '10px';
      pre.textContent = JSON.stringify(data, null, 2);
      rawSection.append(summaryEl, pre);
      result.appendChild(rawSection);
    }

    function addSummary(parent, label, value) {
      const row = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = label + ': ';
      const text = document.createTextNode(String(value));
      row.append(strong, text);
      parent.appendChild(row);
    }

    function appendText(parent, text, tag) {
      const element = document.createElement(tag || 'div');
      element.textContent = text;
      parent.appendChild(element);
      return element;
    }

    function setStatus(value) {
      status.className = 'pill';
      const known = ['completed', 'blocked', 'requires_confirmation', 'max_steps', 'failed'];
      if (known.includes(value)) status.classList.add(value);
      status.textContent = value === 'running' ? 'executando' : value.replaceAll('_', ' ');
    }

    function setRunning(value) {
      runButton.disabled = value;
      running.classList.toggle('visible', value);
    }

    function clear(element) {
      while (element.firstChild) element.removeChild(element.firstChild);
    }
  </script>
</body>
</html>`;
