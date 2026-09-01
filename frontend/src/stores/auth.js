import { defineStore } from 'pinia';
import { api, getToken, setToken } from '../api/client';

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
    consumeTokenFromHash() {
      const hash = window.location.hash || '';
      const match = hash.match(/token=([^&]+)/);
      if (match) {
        setToken(decodeURIComponent(match[1]));
        history.replaceState(null, '', window.location.pathname + window.location.search);
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
    async devLogin(fullName) {
      this.error = '';
      const data = await api('/auth/dev-login', {
        method: 'POST',
        body: { fullName },
      });
      setToken(data.token);
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
      this.user = null;
    },
  },
});
