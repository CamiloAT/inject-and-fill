const Storage = {
  async getProfiles() {
    const data = await chrome.storage.local.get('profiles');
    return data.profiles || [];
  },

  async saveProfiles(profiles) {
    await chrome.storage.local.set({ profiles });
  },

  async addProfile(profile) {
    const profiles = await this.getProfiles();
    profile.id = Date.now().toString();
    profile.createdAt = new Date().toISOString();
    profiles.push(profile);
    await this.saveProfiles(profiles);
    return profile;
  },

  async updateProfile(id, updates) {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex(p => p.id === id);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updates, updatedAt: new Date().toISOString() };
      await this.saveProfiles(profiles);
      return profiles[index];
    }
    return null;
  },

  async deleteProfile(id) {
    const profiles = await this.getProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    await this.saveProfiles(filtered);
  },

  async getActiveProfile() {
    const data = await chrome.storage.local.get('activeProfileId');
    return data.activeProfileId || null;
  },

  async setActiveProfile(id) {
    await chrome.storage.local.set({ activeProfileId: id });
  },

  async getSettings() {
    const data = await chrome.storage.local.get('settings');
    return data.settings || { fillDelay: 200, sequential: true };
  },

  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }
};
