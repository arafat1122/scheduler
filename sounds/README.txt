This app synthesizes its alarm tone live with the Web Audio API
(see notification.js -> ReminderSystem.playAlarmTone), so no alarm.mp3
ships in this folder.

If you'd like to use a real recorded sound instead:
1. Drop your own alarm.mp3 (or .wav/.ogg) file in this folder.
2. In notification.js, replace the playAlarmTone() calls with something like:

   const audio = new Audio('sounds/alarm.mp3');
   audio.volume = (SettingsStore.get().volume ?? 70) / 100;
   audio.play();
