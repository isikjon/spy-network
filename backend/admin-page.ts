export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админка — Spy Network</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; background: #111; color: #ddd; }
    h1 { color: #0f4; margin-top: 0; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    input, button { padding: 8px 12px; margin: 4px; border-radius: 4px; border: 1px solid #444; background: #222; color: #eee; }
    button { cursor: pointer; }
    button.primary { background: #0a4; color: #000; border-color: #0a4; }
    .error { color: #f66; }
    .hidden { display: none; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #333; }
    th { color: #0f4; }
    a { color: #0f4; }
    .logout { float: right; }
  </style>
</head>
<body>
  <div id="loginCard" class="card">
    <h1>Вход</h1>
    <p id="loginError" class="error hidden"></p>
    <div>
      <input type="text" id="username" placeholder="Логин" autocomplete="username">
      <input type="password" id="password" placeholder="Пароль" autocomplete="current-password">
      <button id="loginBtn" class="primary">Войти</button>
    </div>
  </div>
  <div id="dashboard" class="hidden">
    <h1>Пользователи <button id="logoutBtn" class="logout">Выйти</button></h1>
    <div class="card">
      <input type="text" id="search" placeholder="Поиск по номеру...">
      <button id="refreshBtn">Обновить</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Номер</th><th>Досье</th><th>Обновлён</th><th></th></tr></thead>
        <tbody id="usersBody"></tbody>
      </table>
    </div>
    <div id="userDetail" class="card hidden">
      <h2 id="detailTitle"></h2>
      <pre id="detailContent"></pre>
    </div>
  </div>
  <script>
    const API = '';
    let token = localStorage.getItem('adminToken');
    function headers() {
      const h = { 'Content-Type': 'application/json' };
      if (token) h['Authorization'] = 'Bearer ' + token;
      return h;
    }
    function show(el, show) { el.classList.toggle('hidden', !show); }
    function setError(msg) {
      const el = document.getElementById('loginError');
      el.textContent = msg || '';
      el.classList.toggle('hidden', !msg);
    }
    document.getElementById('loginBtn').onclick = async () => {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      if (!username || !password) { setError('Введите логин и пароль'); return; }
      try {
        const r = await fetch(API + '/admin-api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await r.json();
        if (!data.ok) { setError(data.error === 'INVALID_CREDENTIALS' ? 'Неверный логин или пароль' : data.error); return; }
        token = data.token;
        localStorage.setItem('adminToken', token);
        setError('');
        show(document.getElementById('loginCard'), false);
        show(document.getElementById('dashboard'), true);
        loadUsers();
      } catch (e) { setError('Ошибка сети'); }
    };
    document.getElementById('logoutBtn').onclick = () => {
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
        if (r.status === 401) { document.getElementById('logoutBtn').click(); return; }
        const data = await r.json();
        if (!data.ok) return;
        const tbody = document.getElementById('usersBody');
        tbody.innerHTML = data.users.map(u => '<tr><td>' + u.phoneNumber + '</td><td>' + u.dossiersCount + '</td><td>' + new Date(u.updatedAt).toLocaleString() + '</td><td><a href="#" data-phone="' + u.phoneNumber.replace(/"/g, '&quot;') + '">Подробнее</a></td></tr>').join('');
        tbody.querySelectorAll('a[data-phone]').forEach(a => {
          a.onclick = e => { e.preventDefault(); loadUserDetail(a.getAttribute('data-phone')); };
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
