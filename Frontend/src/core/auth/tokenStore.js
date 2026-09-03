const ACCESS_TOKEN_KEYS = new Set(['accessToken']);
const REFRESH_TOKEN_KEYS = new Set(['refreshToken']);
const accessTokenStore = new Map();
let storagePatched = false;

const isAccessTokenKey = (key) => {
  const normalized = String(key || '').trim();
  return ACCESS_TOKEN_KEYS.has(normalized) || normalized.endsWith('_accessToken');
};

const isRefreshTokenKey = (key) => {
  const normalized = String(key || '').trim();
  return REFRESH_TOKEN_KEYS.has(normalized) || normalized.endsWith('_refreshToken');
};

const getModuleFromStorageKey = (key) => {
  const normalized = String(key || '').trim();
  if (normalized === 'accessToken' || normalized === 'refreshToken') return 'user';
  const tokenIndex = normalized.lastIndexOf('_');
  return tokenIndex > 0 ? normalized.slice(0, tokenIndex) : normalized;
};

const installStoragePatch = () => {
  if (storagePatched || typeof window === 'undefined' || !window.localStorage) return;

  const localStorageRef = window.localStorage;
  const originalGetItem = localStorageRef.getItem.bind(localStorageRef);
  const originalSetItem = localStorageRef.setItem.bind(localStorageRef);
  const originalRemoveItem = localStorageRef.removeItem.bind(localStorageRef);

  localStorageRef.getItem = (key) => {
    if (isAccessTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      let token = accessTokenStore.get(moduleName);
      if (!token) {
        token = originalGetItem(key);
        if (!token && window.sessionStorage) {
          try {
            token = window.sessionStorage.getItem(key);
          } catch {}
        }
        if (token) {
          accessTokenStore.set(moduleName, token);
        }
      }
      return token || null;
    }
    if (isRefreshTokenKey(key)) {
      let token = originalGetItem(key);
      if (!token && window.sessionStorage) {
        try {
          token = window.sessionStorage.getItem(key);
        } catch {}
      }
      return token || null;
    }
    return originalGetItem(key);
  };

  localStorageRef.setItem = (key, value) => {
    if (isAccessTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      if (value) {
        accessTokenStore.set(moduleName, String(value));
        originalSetItem(key, String(value));
        if (window.sessionStorage) {
          try {
            window.sessionStorage.setItem(key, String(value));
          } catch {}
        }
      } else {
        accessTokenStore.delete(moduleName);
        originalRemoveItem(key);
        if (window.sessionStorage) {
          try {
            window.sessionStorage.removeItem(key);
          } catch {}
        }
      }
      return;
    }
    if (isRefreshTokenKey(key)) {
      if (value) {
        originalSetItem(key, String(value));
        if (window.sessionStorage) {
          try {
            window.sessionStorage.setItem(key, String(value));
          } catch {}
        }
      } else {
        originalRemoveItem(key);
        if (window.sessionStorage) {
          try {
            window.sessionStorage.removeItem(key);
          } catch {}
        }
      }
      return;
    }
    return originalSetItem(key, value);
  };

  localStorageRef.removeItem = (key) => {
    if (isAccessTokenKey(key)) {
      const moduleName = getModuleFromStorageKey(key);
      accessTokenStore.delete(moduleName);
      originalRemoveItem(key);
      if (window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(key);
        } catch {}
      }
      return;
    }
    if (isRefreshTokenKey(key)) {
      originalRemoveItem(key);
      if (window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(key);
        } catch {}
      }
      return;
    }
    return originalRemoveItem(key);
  };

  storagePatched = true;
};

installStoragePatch();

export const setAccessToken = (moduleName, token) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const key = safeModule === 'user' ? 'accessToken' : `${safeModule}_accessToken`;
  if (!token) {
    accessTokenStore.delete(safeModule);
    try {
      if (typeof window !== 'undefined') {
        if (window.localStorage) window.localStorage.removeItem(key);
        if (window.sessionStorage) window.sessionStorage.removeItem(key);
      }
    } catch {}
    return;
  }
  const strToken = String(token);
  accessTokenStore.set(safeModule, strToken);
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.setItem(key, strToken);
      if (window.sessionStorage) window.sessionStorage.setItem(key, strToken);
    }
  } catch {}
};

export const getAccessToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  let token = accessTokenStore.get(safeModule);
  if (!token && typeof window !== 'undefined') {
    const key = safeModule === 'user' ? 'accessToken' : `${safeModule}_accessToken`;
    try {
      if (window.sessionStorage) token = window.sessionStorage.getItem(key);
      if (!token && window.localStorage) token = window.localStorage.getItem(key);
      if (token) {
        accessTokenStore.set(safeModule, token);
      }
    } catch {}
  }
  return token || null;
};

export const clearAccessToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  accessTokenStore.delete(safeModule);
  const key = safeModule === 'user' ? 'accessToken' : `${safeModule}_accessToken`;
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.removeItem(key);
      if (window.sessionStorage) window.sessionStorage.removeItem(key);
    }
  } catch {}
};

export const clearAllAccessTokens = () => {
  installStoragePatch();
  accessTokenStore.clear();
  try {
    if (typeof window !== 'undefined') {
      ['admin', 'restaurant', 'delivery', 'user'].forEach((m) => {
        const k = m === 'user' ? 'accessToken' : `${m}_accessToken`;
        if (window.localStorage) window.localStorage.removeItem(k);
        if (window.sessionStorage) window.sessionStorage.removeItem(k);
      });
    }
  } catch {}
};

export const hasStoredSession = (moduleName) => {
  installStoragePatch();
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const safeModule = String(moduleName || 'user').trim() || 'user';
  return (
    window.localStorage.getItem(`${safeModule}_authenticated`) === 'true' ||
    Boolean(window.localStorage.getItem(`${safeModule}_user`))
  );
};

export const removeLegacyStoredTokens = (moduleName) => {
  installStoragePatch();
};

export const setRefreshToken = (moduleName, token) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const key = safeModule === 'user' ? 'refreshToken' : `${safeModule}_refreshToken`;
  if (!token) {
    try {
      if (typeof window !== 'undefined') {
        if (window.localStorage) window.localStorage.removeItem(key);
        if (window.sessionStorage) window.sessionStorage.removeItem(key);
      }
    } catch {}
    return;
  }
  const strToken = String(token);
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.setItem(key, strToken);
      if (window.sessionStorage) window.sessionStorage.setItem(key, strToken);
    }
  } catch {}
};

export const getRefreshToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const key = safeModule === 'user' ? 'refreshToken' : `${safeModule}_refreshToken`;
  let token = null;
  try {
    if (typeof window !== 'undefined') {
      if (window.sessionStorage) token = window.sessionStorage.getItem(key);
      if (!token && window.localStorage) token = window.localStorage.getItem(key);
    }
  } catch {}
  return token || null;
};

export const clearRefreshToken = (moduleName) => {
  installStoragePatch();
  const safeModule = String(moduleName || 'user').trim() || 'user';
  const key = safeModule === 'user' ? 'refreshToken' : `${safeModule}_refreshToken`;
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) window.localStorage.removeItem(key);
      if (window.sessionStorage) window.sessionStorage.removeItem(key);
    }
  } catch {}
};

export const bootstrapTokenStore = () => {
  installStoragePatch();
};

