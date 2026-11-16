use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub focus: u64,
    pub short_break: u64,
    pub long_break: u64,
    pub rounds: u32,
    pub auto_break: bool,
    pub auto_focus: bool,
    pub theme: String,
    pub sound: String,
    pub volume: f32,
    pub tips: bool,
    pub notifications: bool,
    pub close_to_tray: bool,
    pub start_hidden: bool,
    pub tray_time: bool,
    pub always_on_top: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            focus: 25,
            short_break: 5,
            long_break: 15,
            rounds: 4,
            auto_break: true,
            auto_focus: false,
            theme: "sand".into(),
            sound: "bowl".into(),
            volume: 0.4,
            tips: true,
            notifications: true,
            close_to_tray: true,
            start_hidden: false,
            tray_time: true,
            always_on_top: false,
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if [self.focus, self.short_break, self.long_break]
            .iter()
            .any(|n| !(1..=180).contains(n))
            || !(1..=12).contains(&self.rounds)
            || !self.volume.is_finite()
            || !(0.0..=1.0).contains(&self.volume)
            || !["sand", "light", "dark", "forest"].contains(&self.theme.as_str())
            || !["bowl", "bell", "none"].contains(&self.sound.as_str())
        {
            return Err("Please check your settings: durations 1–180 minutes, rounds 1–12.".into());
        }
        Ok(())
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timer {
    pub phase: String,
    pub remaining: u64,
    pub total: u64,
    pub completed: u32,
    pub running: bool,
    pub revision: u64,
    #[serde(skip)]
    deadline: u64,
}
impl Timer {
    pub fn new(settings: &Settings) -> Self {
        Self {
            phase: "focus".into(),
            remaining: settings.focus * 60,
            total: settings.focus * 60,
            completed: 0,
            running: false,
            revision: 0,
            deadline: 0,
        }
    }
    pub fn tick(&mut self, now: u64, settings: &Settings) -> bool {
        if !self.running {
            return false;
        }
        self.remaining = self.deadline.saturating_sub(now).div_ceil(1000);
        if self.remaining > 0 {
            return false;
        }
        self.advance(now, settings, true);
        self.revision += 1;
        true
    }
    fn duration(&self, settings: &Settings) -> u64 {
        (match self.phase.as_str() {
            "short" => settings.short_break,
            "long" => settings.long_break,
            _ => settings.focus,
        }) * 60
    }
    fn advance(&mut self, now: u64, settings: &Settings, finished: bool) {
        if self.phase == "focus" {
            if finished {
                self.completed += 1;
            }
            self.phase = if finished && self.completed % settings.rounds == 0 {
                "long"
            } else {
                "short"
            }
            .into();
        } else {
            self.phase = "focus".into();
        }
        self.total = self.duration(settings);
        self.remaining = self.total;
        // After sleep, advance once and start a fresh session; never invent missed sessions.
        self.running = finished
            && if self.phase == "focus" {
                settings.auto_focus
            } else {
                settings.auto_break
            };
        self.deadline = now + self.remaining * 1000;
    }
    pub fn action(
        &mut self,
        action: &str,
        value: Option<u64>,
        now: u64,
        settings: &Settings,
    ) -> Result<(), String> {
        match action {
            "toggle" => {
                self.running = !self.running;
                if self.running {
                    self.deadline = now + self.remaining * 1000;
                }
            }
            "reset" => {
                self.running = false;
                self.remaining = self.total;
            }
            "skip" => self.advance(now, settings, false),
            "focus" | "short" | "long" => {
                self.phase = action.into();
                self.running = false;
                self.total = self.duration(settings);
                self.remaining = self.total;
            }
            "duration" => {
                let minutes = value
                    .filter(|n| (1..=180).contains(n))
                    .ok_or("Choose 1–180 minutes")?;
                self.running = false;
                self.total = minutes * 60;
                self.remaining = self.total;
            }
            _ => return Err("Unknown timer action".into()),
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deadline_survives_sleep_without_counting_phantom_sessions() {
        let s = Settings::default();
        let mut t = Timer::new(&s);
        t.action("toggle", None, 0, &s).unwrap();
        assert!(t.tick(8 * 60 * 60 * 1000, &s));
        assert_eq!(t.completed, 1);
        assert_eq!(t.phase, "short");
        assert_eq!(t.remaining, 300);
        assert!(!t.tick(8 * 60 * 60 * 1000, &s));
    }
    #[test]
    fn pause_resume_preserves_remaining() {
        let s = Settings::default();
        let mut t = Timer::new(&s);
        t.action("toggle", None, 0, &s).unwrap();
        t.tick(10000, &s);
        t.action("toggle", None, 10000, &s).unwrap();
        t.tick(90000, &s);
        assert_eq!(t.remaining, 1490);
        t.action("toggle", None, 90000, &s).unwrap();
        t.tick(100000, &s);
        assert_eq!(t.remaining, 1480);
    }
    #[test]
    fn long_break_and_skips() {
        let s = Settings::default();
        let mut t = Timer::new(&s);
        for _ in 0..4 {
            t.advance(0, &s, true);
            if t.phase == "short" {
                t.advance(0, &s, true);
            }
        }
        assert_eq!(t.phase, "long");
        assert_eq!(t.completed, 4);
        t.action("skip", None, 0, &s).unwrap();
        t.action("skip", None, 0, &s).unwrap();
        assert_eq!(t.completed, 4);
        assert!(!t.running);
    }
}
