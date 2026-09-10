import { defineStore } from 'pinia';
import { api, clearLegacyToken, setToken } from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    error: '',
  }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    permissions: (s) => s.user?.role?.permissions || [],
    can: (s) => (perm) => (s.user?.role?.permissions || []).includes(perm),
  },
  actions: {
    async consumeAuthCodeFromQuery() {
      clearLegacyToken();
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) return;
      params.delete('code');
      const qs = params.toString();
      history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
      );
      try {
        const data = await api('/auth/exchange', {
          method: 'POST',
          body: { code },
        });
        if (data.token) {
          setToken(data.token);
        }
        this.user = data.user;
        this.error = '';
      } catch (e) {
        setToken(null);
        this.error = e.message || 'Не удалось войти';
      }
    },
    async fetchMe() {
      this.loading = true;
      try {
        this.user = await api('/auth/me');
        this.error = '';
        return this.user;
      } catch {
        this.user = null;
        setToken(null);
        return null;
      } finally {
        this.loading = false;
      }
    },
    async devLogin(payload) {
      this.error = '';
      const body =
        typeof payload === 'string'
          ? { fullName: payload }
          : {
              fullName: payload.fullName,
              roleSlug: payload.roleSlug,
              bitrixUserId: payload.bitrixUserId,
            };
      const data = await api('/auth/dev-login', {
        method: 'POST',
        body,
      });
      if (data.token) {
        setToken(data.token);
      }
      this.user = data.user;
      return data.user;
    },
    async logout() {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch {
        // cookie may already be gone
      }
      setToken(null);
      clearLegacyToken();
      this.user = null;
    },
  },
});
