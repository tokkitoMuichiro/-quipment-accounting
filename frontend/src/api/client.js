const TOKEN_KEY = 'equipment_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const SERVER_DOWN =
  'Сервер ещё не запущен. Дождитесь в терминале backend строки «Nest application successfully started» и войдите снова.';

async function parseError(res) {
  try {
    const data = await res.json();
    const msg = data.message;
    return Array.isArray(msg) ? msg.join(', ') : msg || 'Ошибка запроса';
  } catch {
    if (res.status >= 500) {
      return SERVER_DOWN;
    }
    return 'Ошибка запроса';
  }
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers,
      body:
        options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch {
    throw new Error(SERVER_DOWN);
  }

  if (res.status === 401) {
    setToken(null);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Нужна авторизация');
  }

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.blob();
}
