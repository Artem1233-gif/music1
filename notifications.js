import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const notificationKeys = new Set(['track', 'done', 'err']);
let channelReady = false;

async function ensurePermission() {
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    permission = await LocalNotifications.requestPermissions();
  }
  return permission.display === 'granted';
}

async function show(title, body, details = '') {
  if (Capacitor.isNativePlatform()) {
    if (!(await ensurePermission())) {
      throw new Error('Разрешите уведомления в настройках Android');
    }
    if (!channelReady) {
      await LocalNotifications.createChannel({
        id: 'music_notifications',
        name: 'Уведомления Моя Музыка',
        description: 'Уведомления о воспроизведении и завершении действий',
        importance: 4,
        visibility: 1,
      });
      channelReady = true;
    }
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Date.now() % 2147483647),
        title: String(title || 'Моя Музыка'),
        body: String(body || details || ''),
        largeBody: String(details || body || ''),
        channelId: 'music_notifications',
        schedule: { at: new Date(Date.now() + 300) },
      }],
    });
    return;
  }

  if (!('Notification' in window)) throw new Error('Уведомления не поддерживаются этим браузером');
  let permission = Notification.permission;
  if (permission !== 'granted') permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера');
  new Notification(String(title || 'Моя Музыка'), { body: String(body || details || '') });
}

window.AppNotifications = { ensurePermission, show };

// Existing player code calls AndroidAPI when it is available. Bridge that API
// to Capacitor Local Notifications so playback/import messages reach Android.
const previous = window.AndroidAPI || {};
window.AndroidAPI = {
  ...previous,
  showNotification: (title, body, details) => show(title, body, details).catch(error => {
    console.warn('Notification failed:', error);
    window.onAndroidEvent?.('notificationResult', { success: false, error: error.message });
  }),
  showToast: message => window.toast?.(message),
  vibrate: ms => navigator.vibrate?.(ms),
  vibratePattern: (pattern, repeat) => {
    try { navigator.vibrate?.(JSON.parse(pattern)); } catch {}
  },
  updateMediaNotification: data => {
    if (data?.isPlaying) show(data.title, data.artist).catch(error => console.warn('Media notification failed:', error));
  },
};

function addNotificationSetup() {
  const list = document.getElementById('setlist');
  if (!list || document.getElementById('notificationSetup')) return;
  const button = document.createElement('button');
  button.id = 'notificationSetup';
  button.className = 'more';
  button.textContent = 'Разрешить и проверить уведомления';
  button.addEventListener('click', async () => {
    try {
      if (!(await ensurePermission())) throw new Error('Разрешение не выдано. Проверьте настройки приложения в Android.');
      await show('Моя Музыка', 'Уведомления включены');
      if (typeof window.toast === 'function') window.toast('Тестовое уведомление отправлено');
    } catch (error) {
      console.warn('Notification permission failed:', error);
      if (typeof window.toast === 'function') window.toast(error.message || 'Не удалось включить уведомления');
      else alert(error.message || 'Не удалось включить уведомления');
    }
  });
  list.append(button);
}

function watchNotificationSettings() {
  document.getElementById('setlist')?.addEventListener('change', async event => {
    if (!event.target.matches('input[type="checkbox"][data-k]') || !event.target.checked || !notificationKeys.has(event.target.dataset.k)) return;
    try {
      if (!(await ensurePermission())) throw new Error('Уведомления запрещены в настройках Android');
    } catch (error) {
      console.warn('Notification permission failed:', error);
      if (typeof window.toast === 'function') window.toast(error.message || 'Не удалось включить уведомления');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { addNotificationSetup(); watchNotificationSettings(); });
} else {
  addNotificationSetup();
  watchNotificationSettings();
}
