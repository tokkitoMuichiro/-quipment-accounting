import { defineStore } from 'pinia';
import { syncDocuments } from '../api/equipment';

export const useDocsSyncStore = defineStore('docsSync', {
  state: () => ({
    running: false,
    /** Bumped whenever a sync changed something, so lists can reload. */
    nonce: 0,
    startedOnce: false,
  }),
  actions: {
    async runOnce() {
      if (this.startedOnce || this.running) return;
      this.startedOnce = true;
      await this.run();
    },
    async run() {
      this.running = true;
      try {
        const result = await syncDocuments();
        if (result?.changed) {
          this.nonce += 1;
        }
      } catch {
        // Битрикс может быть недоступен — список остаётся как есть
      } finally {
        this.running = false;
      }
    },
  },
});
