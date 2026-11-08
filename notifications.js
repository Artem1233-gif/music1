import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

let channelReady = false;
let lastTrackNotice = '';

async function requestPermission() {
  if (Capacitor.isNativePlatform()) {
    let result = await LocalNotifications.checkPermissions();
    if (result.display !== 'granted') result = await LocalNotifications.requestPermissions();
    if (result.display !== 'granted') throw new Error('Разрешите уведомления в настройках Android');
    if (!channelReady) {
      await LocalNotifications.createChannel({
        id: 'music_notifications',
        name: 'Моя Музыка',
        description: 'Уведомления приложения',
        importance: 4,
        visibility: 1,
      });
      channelReady = true;
    }
    return true;
  }
  if (!('Notification' in window)) throw new Error('Уведомления не поддерживаются этим браузером');
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера');
  return true;
}

async function showNotification(title, body, details = '') {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return false;
    if (!channelReady) {
      await LocalNotifications.createChannel({
        id: 'music_notifications', name: 'Моя Музыка',
        description: 'Уведомления приложения', importance: 4, visibility: 1,
      });
      channelReady = true;
    }
    const id = Math.floor(Date.now() % 2147483647) || 1;
    await LocalNotifications.schedule({ notifications: [{
      id,
      title: String(title || 'Моя Музыка'),
      body: String(body || details || ''),
      largeBody: String(details || body || ''),
      channelId: 'music_notifications',
      schedule: { at: new Date(Date.now() + 250) },
    }] });
    return true;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  new Notification(String(title || 'Моя Музыка'), { body: String(body || details || '') });
  return true;
}

window.AppNotifications = { requestPermission, show: showNotification };

// Preserve app hooks without overriding showToast (which would recurse).
const previous = window.AndroidAPI || {};
window.AndroidAPI = {
  ...previous,
  showNotification: (title, body, details) => {
    showNotification(title, body, details).catch(error => console.warn('Notification failed:', error));
  },
  vibrate: ms => navigator.vibrate?.(ms),
  vibratePattern: pattern => {
    try { navigator.vibrate?.(JSON.parse(pattern)); } catch {}
  },
  updateMediaNotification: data => {
    if (!data?.isPlaying) return;
    const key = `${data.title || ''}\n${data.artist || ''}`;
    if (!key.trim() || key === lastTrackNotice) return;
    lastTrackNotice = key;
    showNotification(data.title, data.artist).catch(error => console.warn('Track notification failed:', error));
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
      await requestPermission();
      await showNotification('Моя Музыка', 'Уведомления включены');
      if (typeof window.toast === 'function') window.toast('Тестовое уведомление отправлено');
    } catch (error) {
      console.warn('Notification permission failed:', error);
      if (typeof window.toast === 'function') window.toast(error.message || 'Не удалось включить уведомления');
      else alert(error.message || 'Не удалось включить уведомления');
    }
  });
  list.append(button);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addNotificationSetup, { once: true });
} else {
  addNotificationSetup();
}
