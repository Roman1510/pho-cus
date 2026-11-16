mod timer;
use std::{
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_notification::NotificationExt;
use timer::{Settings, Timer};

struct AppState(Mutex<(Settings, Timer)>);
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    settings: Settings,
    timer: Timer,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn snapshot(state: &AppState) -> Snapshot {
    let guard = state.0.lock().unwrap();
    Snapshot {
        settings: guard.0.clone(),
        timer: guard.1.clone(),
    }
}
#[tauri::command]
fn get_state(state: tauri::State<AppState>) -> Snapshot {
    snapshot(&state)
}
#[tauri::command]
fn timer_action(
    action: String,
    value: Option<u64>,
    state: tauri::State<AppState>,
) -> Result<Snapshot, String> {
    {
        let mut guard = state.0.lock().unwrap();
        let (settings, timer) = &mut *guard;
        timer.action(&action, value, now(), settings)?;
    }
    Ok(snapshot(&state))
}
#[tauri::command]
fn save_settings(
    settings: Settings,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Snapshot, String> {
    settings.validate()?;
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("settings.json");
    std::fs::write(
        &file,
        serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if let Some(w) = app.get_webview_window("main") {
        w.set_always_on_top(settings.always_on_top)
            .map_err(|e| e.to_string())?;
    }
    {
        let mut guard = state.0.lock().unwrap();
        // Editing session defaults updates an untouched timer, but never interrupts a session.
        if !guard.1.running && guard.1.remaining == guard.1.total {
            let phase = guard.1.phase.clone();
            guard.1.action(&phase, None, now(), &settings)?;
        }
        guard.0 = settings;
    }
    Ok(snapshot(&state))
}
fn show(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}
fn tray_image() -> tauri::image::Image<'static> {
    let mut rgba = vec![0u8; 32 * 32 * 4];
    for y in 0..32 {
        for x in 0..32 {
            let d = ((x as f32 - 15.5).powi(2) + (y as f32 - 15.5).powi(2)).sqrt();
            if (11.0..14.0).contains(&d)
                || ((14..=17).contains(&x) && (7..=16).contains(&y))
                || ((15..=23).contains(&x) && (14..=17).contains(&y))
            {
                let i = (y * 32 + x) * 4;
                rgba[i..i + 4].copy_from_slice(&[100, 115, 91, 255]);
            }
        }
    }
    tauri::image::Image::new_owned(rgba, 32, 32)
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_state,
            timer_action,
            save_settings
        ])
        .setup(|app| {
            let settings: Settings = app
                .path()
                .app_config_dir()
                .ok()
                .and_then(|p| std::fs::read(p.join("settings.json")).ok())
                .and_then(|data| serde_json::from_slice::<Settings>(&data).ok())
                .filter(|s| s.validate().is_ok())
                .unwrap_or_default();
            let timer = Timer::new(&settings);
            let hidden = settings.start_hidden;
            if let Some(w) = app.get_webview_window("main") {
                w.set_always_on_top(settings.always_on_top)?;
            }
            app.manage(AppState(Mutex::new((settings, timer))));
            let status = MenuItem::with_id(app, "status", "Focus · 25:00", false, None::<&str>)?;
            let toggle = MenuItem::with_id(app, "toggle", "Start", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Show pho-cus", true, None::<&str>)?;
            let skip = MenuItem::with_id(app, "skip", "Skip session", true, None::<&str>)?;
            let reset = MenuItem::with_id(app, "reset", "Reset timer", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit pho-cus", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&status, &open, &toggle, &skip, &reset, &settings, &quit],
            )?;
            TrayIconBuilder::with_id("focus")
                .icon(tray_image())
                .icon_as_template(true)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "open" => show(app),
                    "settings" => {
                        show(app);
                        let _ = app.emit("open-settings", ());
                    }
                    action @ ("toggle" | "skip" | "reset") => {
                        let _ = timer_action(action.into(), None, app.state());
                    }
                    _ => {}
                })
                .build(app)?;
            if !hidden {
                show(app.handle());
            }
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(250));
                let state = handle.state::<AppState>();
                let (finished, settings, timer) = {
                    let mut guard = state.0.lock().unwrap();
                    let (s, t) = &mut *guard;
                    (t.tick(now(), s), s.clone(), t.clone())
                };
                let phase = match timer.phase.as_str() {
                    "short" => "Short break",
                    "long" => "Long break",
                    _ => "Focus",
                };
                let time = format!("{:02}:{:02}", timer.remaining / 60, timer.remaining % 60);
                let label = format!(
                    "{phase} · {time}{}",
                    if timer.running { "" } else { " · paused" }
                );
                let _ = status.set_text(&label);
                let _ = toggle.set_text(if timer.running { "Pause" } else { "Start" });
                if let Some(tray) = handle.tray_by_id("focus") {
                    let _ = tray.set_tooltip(Some(&label));
                    #[cfg(target_os = "macos")]
                    let _ = tray.set_title(Some(if settings.tray_time {
                        time.as_str()
                    } else {
                        ""
                    }));
                }
                if finished {
                    if settings.notifications {
                        let body = if timer.phase == "focus" {
                            "Ready when you are. A fresh moment to focus."
                        } else if settings.tips {
                            "Let your shoulders drop. Stretch gently and look into the distance."
                        } else {
                            "Your focus session is complete. Take a little break."
                        };
                        if let Err(e) = handle
                            .notification()
                            .builder()
                            .title(format!("pho-cus · {phase}"))
                            .body(body)
                            .show()
                        {
                            log::warn!("Notification failed: {e}");
                        }
                    }
                    let _ = handle.emit("session-finished", timer.revision);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                if state.0.lock().unwrap().0.close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running pho-cus");
}
