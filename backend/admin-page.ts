export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Админка — Spy Network</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/pages.css">
  <style>
    .admin-page-hidden { display: none; }
    .admin-dashboard { max-width: 1000px; margin: 0 auto; padding: 60px 24px; }
    .admin-dashboard h1 { font-size: 24px; letter-spacing: 4px; margin-bottom: 0; }
    .admin-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; padding: 20px; border: 2px solid var(--border); background: var(--overlay); }
    .admin-toolbar input { flex: 1; min-width: 200px; padding: 12px 16px; font-family: var(--font-mono); font-size: 14px; background: var(--bg); border: 2px solid var(--border); color: var(--text); }
    .admin-toolbar input:focus { outline: none; border-color: var(--primary); }
    .admin-toolbar .btn { margin: 0; }
    .admin-header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid var(--border); }
    .admin-header-row .btn-secondary { padding: 10px 20px; font-size: 12px; }
    .admin-table-wrap { overflow-x: auto; border: 2px solid var(--border); background: var(--card); }
    .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .admin-table th, .admin-table td { text-align: left; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .admin-table th { font-size: 11px; letter-spacing: 2px; color: var(--primary); background: rgba(0, 255, 65, 0.05); }
    .admin-table tr:hover td { background: var(--overlay); }
    .admin-table a { color: var(--primary); text-decoration: none; letter-spacing: 1px; }
    .admin-table a:hover { text-decoration: underline; }
    .admin-detail { margin-top: 24px; padding: 24px; border: 2px solid var(--border); background: var(--card); }
    .admin-detail h2 { font-size: 16px; letter-spacing: 2px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .admin-detail pre { font-size: 12px; color: var(--text-secondary); overflow-x: auto; margin: 0; white-space: pre-wrap; word-break: break-all; }
    .admin-login-error { margin-top: 12px; padding: 12px; font-size: 12px; color: var(--danger); background: rgba(255, 0, 51, 0.1); border: 1px solid var(--danger); }
    .admin-tabs-row { display: flex; gap: 0; margin-bottom: 24px; border: 2px solid var(--border); background: var(--card); }
    .admin-tab-btn { flex: 1; padding: 14px 20px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 2px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
    .admin-tab-btn:hover { color: var(--text); }
    .admin-tab-btn.active { background: var(--overlay); color: var(--primary); border-bottom: 2px solid var(--primary); }
    .admin-panel { display: block; }
    .admin-panel.admin-page-hidden { display: none; }
    .admin-analytics-info { padding: 24px; border: 2px solid var(--border); background: var(--card); }
    .admin-analytics-info h2 { font-size: 18px; letter-spacing: 2px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .admin-analytics-info p, .admin-analytics-info li { font-size: 13px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 12px; }
    .admin-analytics-info ol { padding-left: 24px; margin-bottom: 16px; }
    .admin-analytics-info code { padding: 2px 6px; background: var(--overlay); border: 1px solid var(--border); font-size: 12px; }
  </style>
</head>
<body>
  <div class="scanlines"></div>
  <div class="grid-overlay"></div>

  <nav class="navbar">
    <div class="nav-container">
      <a href="/" class="logo">
        <span class="logo-icon">◆</span>
        <span class="logo-text">SPY NETWORK</span>
      </a>
      <div class="nav-links">
        <a href="/">ГЛАВНАЯ</a>
        <a href="/admin" class="nav-admin active">ADMIN</a>
      </div>
    </div>
  </nav>

  <div id="loginCard" class="page-content">
    <div class="admin-container">
      <div class="admin-box">
        <div class="admin-header">
          <div class="admin-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1>ДОСТУП К СИСТЕМЕ</h1>
          <p>Введите учётные данные администратора</p>
        </div>
        <form class="admin-form" id="adminForm" onsubmit="return false;">
          <div class="form-group">
            <label for="username">ИДЕНТИФИКАТОР</label>
            <input type="text" id="username" placeholder="admin" autocomplete="username" required>
          </div>
          <div class="form-group">
            <label for="password">КОД ДОСТУПА</label>
            <input type="password" id="password" placeholder="••••••••" autocomplete="current-password" required>
            <div id="loginError" class="admin-login-error admin-page-hidden"></div>
          </div>
          <button type="button" class="btn" id="loginBtn">ВОЙТИ В СИСТЕМУ</button>
          <div class="status-indicator">
            <span class="dot"></span>
            <span>СИСТЕМА ЗАЩИЩЕНА</span>
          </div>
        </form>
        <div class="admin-footer">
          <a href="/">← Вернуться на главную</a>
        </div>
      </div>
    </div>
  </div>

  <div id="dashboard" class="admin-page-hidden">
    <main class="page-content">
      <div class="admin-dashboard">
        <div class="admin-header-row">
          <h1 id="dashboardTitle">ПОЛЬЗОВАТЕЛИ</h1>
          <button type="button" class="btn btn-secondary" id="logoutBtn">ВЫЙТИ</button>
        </div>
        <div class="admin-tabs-row">
          <button type="button" class="admin-tab-btn active" id="tabUsers" data-tab="users">ПОЛЬЗОВАТЕЛИ</button>
          <button type="button" class="admin-tab-btn" id="tabAnalytics" data-tab="analytics">АНАЛИТИКА</button>
        </div>
        <div id="panelUsers" class="admin-panel">
        <div class="admin-toolbar">
          <input type="text" id="search" placeholder="Поиск по номеру...">
          <button type="button" class="btn" id="refreshBtn">ОБНОВИТЬ</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>НОМЕР</th>
                <th>ДОСЬЕ</th>
                <th>ОБНОВЛЁН</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="usersBody"></tbody>
          </table>
        </div>
        <div id="userDetail" class="admin-detail admin-page-hidden">
          <h2 id="detailTitle"></h2>
          <pre id="detailContent"></pre>
        </div>
        </div>
        <div id="panelAnalytics" class="admin-panel admin-page-hidden">
          <div class="admin-analytics-info">
            <h2>Аналитика в мобильном приложении</h2>
            <p>Полный раздел <strong>«АНАЛИТИКА»</strong> (статистика по пользователям, шесть рукопожатий, властные группировки) доступен только в мобильном приложении Spy Network.</p>
            <p><strong>Как зайти:</strong></p>
            <ol>
              <li>Откройте приложение на телефоне (или в эмуляторе).</li>
              <li>Перейдите на экран <strong>Админ</strong> (из меню или по диплинку <code>…/admin</code>).</li>
              <li>Введите логин и пароль администратора и нажмите <strong>Войти</strong>.</li>
              <li>После входа токен сохраняется автоматически — вводить его нигде не нужно.</li>
              <li>Появится вкладка <strong>«АНАЛИТИКА»</strong> с подразделами: пользователи, досье, сеть, профиль, шесть рукопожатий, властные группировки.</li>
            </ol>
            <p>В веб-версии админки (эта страница) доступен только список пользователей. Для полной аналитики используйте приложение.</p>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const API = '';
    let token = localStorage.getItem('adminToken');
    function headers() {
      const h = { 'Content-Type': 'application/json' };
      if (token) h['x-admin-auth'] = 'Bearer ' + token;
      return h;
    }
    function show(el, visible) { el.classList.toggle('admin-page-hidden', !visible); }
    function setError(msg) {
      const el = document.getElementById('loginError');
      el.textContent = msg || '';
      el.classList.toggle('admin-page-hidden', !msg);
    }
    function loginErrorText(err) {
      if (err === 'NOT_CONFIGURED') return 'На сервере не настроена админка. Задайте переменные окружения при запуске контейнера.';
      if (err === 'INVALID_CREDENTIALS') return 'Неверный логин или пароль.';
      return err || 'Ошибка входа';
    }
    document.getElementById('loginBtn').onclick = async function() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (!username || !password) { setError('Введите логин и пароль'); return; }
      setError('');
      try {
        const r = await fetch(API + '/admin-api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password })
        });
        const data = await r.json();
        if (!data.ok) { setError(loginErrorText(data.error)); return; }
        token = data.token;
        localStorage.setItem('adminToken', token);
        setError('');
        show(document.getElementById('loginCard'), false);
        show(document.getElementById('dashboard'), true);
        loadUsers();
      } catch (e) { setError('Ошибка сети: ' + (e.message || 'нет ответа от сервера')); }
    };
    document.getElementById('logoutBtn').onclick = function() {
      token = null;
      localStorage.removeItem('adminToken');
      show(document.getElementById('dashboard'), false);
      show(document.getElementById('loginCard'), true);
    };
    async function loadUsers() {
      const query = document.getElementById('search').value;
      let url = API + '/admin-api/users?limit=200';
      if (query) url += '&query=' + encodeURIComponent(query);
      try {
        const r = await fetch(url, { headers: headers() });
        if (r.status === 401) {
          token = null;
          localStorage.removeItem('adminToken');
          show(document.getElementById('dashboard'), false);
          show(document.getElementById('loginCard'), true);
          setError('Сессия недействительна или истекла. Войдите снова.');
          return;
        }
        const data = await r.json();
        if (!data.ok) return;
        const tbody = document.getElementById('usersBody');
        tbody.innerHTML = data.users.map(function(u) {
          const phone = (u.phoneNumber || '').replace(/"/g, '&quot;');
          return '<tr><td>' + u.phoneNumber + '</td><td>' + u.dossiersCount + '</td><td>' + new Date(u.updatedAt).toLocaleString() + '</td><td><a href="#" data-phone="' + phone + '">Подробнее</a></td></tr>';
        }).join('');
        tbody.querySelectorAll('a[data-phone]').forEach(function(a) {
          a.onclick = function(e) { e.preventDefault(); loadUserDetail(a.getAttribute('data-phone')); };
        });
      } catch (e) { console.error(e); }
    }
    async function loadUserDetail(phone) {
      try {
        const r = await fetch(API + '/admin-api/users/' + encodeURIComponent(phone), { headers: headers() });
        if (r.status === 401) { document.getElementById('logoutBtn').click(); return; }
        const data = await r.json();
        if (!data.ok) return;
        document.getElementById('detailTitle').textContent = 'Пользователь: ' + data.phoneNumber;
        document.getElementById('detailContent').textContent = JSON.stringify(data, null, 2);
        show(document.getElementById('userDetail'), true);
      } catch (e) { console.error(e); }
    }
    document.getElementById('refreshBtn').onclick = loadUsers;
    function switchTab(tab) {
      var isUsers = tab === 'users';
      document.getElementById('panelUsers').classList.toggle('admin-page-hidden', !isUsers);
      document.getElementById('panelAnalytics').classList.toggle('admin-page-hidden', isUsers);
      document.getElementById('tabUsers').classList.toggle('active', isUsers);
      document.getElementById('tabAnalytics').classList.toggle('active', !isUsers);
      document.getElementById('dashboardTitle').textContent = isUsers ? 'ПОЛЬЗОВАТЕЛИ' : 'АНАЛИТИКА';
    }
    document.getElementById('tabUsers').onclick = function() { switchTab('users'); };
    document.getElementById('tabAnalytics').onclick = function() { switchTab('analytics'); };
    (async function init() {
      if (!token) return;
      const r = await fetch(API + '/admin-api/me', { headers: headers() });
      if (r.status !== 200) { token = null; localStorage.removeItem('adminToken'); return; }
      show(document.getElementById('loginCard'), false);
      show(document.getElementById('dashboard'), true);
      loadUsers();
    })();
  </script>
</body>
</html>`;
