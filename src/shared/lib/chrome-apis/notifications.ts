function notificationsAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.notifications;
}

export function createNotification(
  id: string,
  options: chrome.notifications.NotificationCreateOptions,
): Promise<string> {
  return chrome.notifications.create(id, options) as Promise<string>;
}

export function getNotificationPermissionLevel(): Promise<string> {
  if (!notificationsAvailable()) return Promise.resolve('denied');
  return chrome.notifications.getPermissionLevel();
}

export function onNotificationClicked(
  callback: (notificationId: string) => void,
): void {
  if (!notificationsAvailable()) return;
  chrome.notifications.onClicked.addListener(callback);
}

export function onNotificationButtonClicked(
  callback: (notificationId: string, buttonIndex: number) => void,
): void {
  if (!notificationsAvailable()) return;
  chrome.notifications.onButtonClicked.addListener(callback);
}
