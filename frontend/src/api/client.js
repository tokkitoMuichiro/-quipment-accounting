const TOKEN_KEY = 'equipment_token';
const LEGACY_TOKEN_KEY = 'equipment_token'; // was in localStorage

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // private mode / blocked storage
  }
}

/** Убрать старый токен из localStorage (больше не используем). */
export function clearLegacyToken() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore
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
    const isAuthBootstrap =
      path.startsWith('/auth/exchange') ||
      path.startsWith('/auth/dev-status') ||
      path.startsWith('/auth/dev-login');
    if (!isAuthBootstrap) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    throw new Error(await parseError(res));
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
