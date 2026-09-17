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

function onUnauthorized() {
  setToken(null);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
  return new Error('Нужна авторизация');
}

/**
 * Загрузка файла через XHR: fetch не отдаёт прогресс отправки,
 * а документы бывают на десятки мегабайт.
 */
export function apiUpload(path, { body, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.withCredentials = true;
    const token = getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        reject(onUnauthorized());
        return;
      }
      if (xhr.status === 413) {
        reject(
          new Error(
            'Файл не принял сервер: слишком большой. Уменьшите файл или обратитесь к администратору.',
          ),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null);
        } catch {
          resolve(null);
        }
        return;
      }
      let message = 'Ошибка загрузки файла';
      try {
        const data = JSON.parse(xhr.responseText);
        const raw = data.message;
        message = Array.isArray(raw) ? raw.join(', ') : raw || message;
      } catch {
        if (xhr.status >= 500) message = SERVER_DOWN;
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Не удалось отправить файл: нет связи с сервером'));
    xhr.ontimeout = () => reject(new Error('Загрузка файла заняла слишком много времени'));

    xhr.send(body);
  });
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
    throw onUnauthorized();
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
