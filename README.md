# pho-cus

A calm, local desktop focus timer built with React, TypeScript, and Tauri 2. Mac menu bar and Windows system tray support live in the Rust backend.

## Run

Install Node.js and Rust, plus the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
npm install
npm run tauri dev
```

`npm run dev` opens a browser-only preview. It has a lightweight timer simulation; native tray controls, persistent settings, and desktop notifications require Tauri. Browser preview settings are temporary. Port 5173 must be free for desktop development.

```sh
npm run build
npm run lint
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

Build installers on each target operating system. Signing and notarization are not configured.

## Included

- Click-to-edit duration, quick presets, focus/short/long-break sessions.
- Adjustable session lengths, long-break frequency, and automatic transitions.
- Four calm themes, synthesized bowl/bell chimes, volume and sound preview.
- Offline synthesized brown/white ambient noise, separate volume, optional audio during breaks.
- Native tray menu: show window, start/pause, skip, reset, settings, quit.
- Close to tray, start hidden on next launch, always on top, optional Mac menu bar countdown. Windows uses a tooltip and menu for the countdown.
- Native desktop notifications with optional stretch reminders.
- Settings saved to `settings.json` in Tauri's platform application config directory.

## Timer behavior

The Rust timer owns session state. Its deadline is checked every 250 milliseconds independently of the webview. Hiding the window does not stop timing. After sleep, an elapsed session completes once and the next session begins from wake time if auto-start is enabled. Skips do not count as completed focus sessions and leave the next session paused. Changing duration pauses and resets the current session. Reset returns to the selected duration. Quitting stops the timer; relaunch starts a fresh focus session.

The UI polls native state every 500 milliseconds. Desktop notification delivery runs natively; custom chimes and ambient audio currently use Web Audio and need an initial interaction in the window. Chimes may be delayed if the OS suspends the webview. System notification permissions / Focus settings can also suppress notifications. Windows notifications should be tested from an installed build.

## Next iterations

- Test installed builds on macOS and Windows, including tray recovery, sleep/wake, notification permissions, and sound while hidden.
- Persist interrupted sessions and ambient preferences; add editable preset sets.
- Native background chime playback, custom sound files, licensed nature recordings.
- Separate mini timer, launch at login, optional Mac Dock visibility.
- Evaluate official YouTube / SoundCloud embeds before enabling remote audio; none are loaded in this version.

The Rust tests cover elapsed deadlines after sleep, pause/resume, long-break cadence, and skip behavior. The browser preview is a design aid, not a replacement for native platform testing.
