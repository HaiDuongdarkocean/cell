export function createAlarm(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void> {
  return chrome.alarms.create(name, alarmInfo);
}

export function getAlarm(name: string): Promise<chrome.alarms.Alarm | undefined> {
  return chrome.alarms.get(name);
}

export function clearAlarm(name: string): Promise<boolean> {
  return chrome.alarms.clear(name);
}

export function onAlarm(
  callback: (alarm: chrome.alarms.Alarm) => void,
): void {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  chrome.alarms.onAlarm.addListener(callback);
}

export function removeOnAlarmListener(
  callback: (alarm: chrome.alarms.Alarm) => void,
): void {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  chrome.alarms.onAlarm.removeListener(callback);
}
