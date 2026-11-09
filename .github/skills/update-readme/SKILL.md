---
name: update-readme
description: Regenerate the 8 PerFormEd 3D application screenshots in docs/screenshots/ at 1730x1860 resolution and update README.md whenever UI controls, avatars, camera views, or features in performed3d.html change.
---

# Update README & Screenshots Skill (`update-readme`)

Use this skill whenever the user asks to update `README.md`, refresh the screenshots in `docs/screenshots/`, or document new features/UI changes in `performed3d.html`.

## Screenshot Specifications & Requirements

All screenshots in `docs/screenshots/*.png` must adhere to the following exact specifications:

1. **Dimensions**: `1730 x 1860` pixels (`865 x 930` CSS viewport rendered at `deviceScaleFactor: 2` Retina scale).
2. **Flight & Control State for Avatar Screenshots (`02-flight.png`, `03-delorean.png`, `04-ufo.png`, `04-ufo-topdown.png`, `05-front.png`, `05-fuchur.png`)**:
   - **`START FLIGHT` Clicked**: The workout must be actively flying (`#startWorkoutBtn` clicked so the button displays `PAUSE FLIGHT` and the compact status strip is active). Do **not** click `Finish & Summary` (`#finishWorkoutBtn`) until after all avatar flight screenshots have been captured.
   - **Forward Velocity Temporarily Set to Zero (Before Any Gate Is Reached)**: After training is started, temporarily set the forward velocity to zero so that no forward movement happens (`dragon3D.flightZ = 0`, `dragon3D.subSec = 0`, `dragon3D.baseElapsedSec = state.elapsedSec`) while vertical altitude and avatar animations still respond to target watts. This ensures all avatar screenshots are captured before any gate is reached (`state.gatesPassedCount === 0`, with the first gate ahead at `z = -60`). Restore normal forward velocity after the avatar screenshots are taken.
   - **`Auto-Fly Target Gate` Checked**: `#simAutoFollowCheck` must be checked (`true`) so simulated watts automatically track the current block's target power.
   - **`Steering` Turned Off**: `#steeringToggleCheck` must be unchecked (`false`, displaying `Steering: OFF (Auto-Fly Gates)`). With steering turned off, `dragonWorldX` automatically tracks the canyon gate center (`currentCourseX`), ensuring every avatar is aligned straight with the glowing target-watt donut rings ahead.

## The 8 Screenshots in `docs/screenshots/`

| File | State | Avatar (`#avatarSelect`) | Camera (`#cameraViewSelect`) | Resistance (`#resistanceModeSelect`) | Notes |
|------|-------|--------------------------|------------------------------|--------------------------------------|-------|
| `01-start.png` | Pre-flight (`START FLIGHT` not yet clicked) | `aero_wyvern` | `1` (Chase) | `easy` | Shows expanded top setup bar with `Steering: OFF (Auto-Fly Gates)` and `Auto-Fly Target Gate` checked |
| `02-flight.png` | Active flight (`START FLIGHT` clicked) | `aero_wyvern` | `1` (Chase) | `easy` | Active flight through target-watt donut gates |
| `03-delorean.png` | Active flight (`START FLIGHT` clicked) | `delorean` | `1` (Chase) | `medium` | Skipped forward (`#skipSegmentBtn`) to a higher-watt block |
| `04-ufo.png` | Active flight (`START FLIGHT` clicked) | `mars_ufo` | `1` (Chase) | `medium` | Mars Attacks UFO flying through canyon gates |
| `04-ufo-topdown.png` | Active flight (`START FLIGHT` clicked) | `mars_ufo` | `3` (Top-Down) | `medium` | Overhead view of UFO aligned with canyon gates |
| `05-front.png` | Active flight (`START FLIGHT` clicked) | `aero_wyvern` | `4` (Front) | `easy` | Front camera looking back at the Wyvern and gates |
| `05-fuchur.png` | Active flight (`START FLIGHT` clicked) | `fuchur` | `1` (Chase) | `easy` | Fuchur (Luckdragon) flying through the donut gates |
| `06-summary.png` | Post-flight (`#finishWorkoutBtn` clicked last) | any | any | any | Shows the Workout Complete summary modal and `.fit` / `.tcx` / `.csv` export buttons |

## Step-by-Step Workflow

### 1. Regenerate All Screenshots
Run the bundled automation script from the repository root:

```bash
python3 .github/skills/update-readme/capture_screenshots.py
```

### 2. Verify Dimensions and Visual Quality
1. Check that all 8 PNG files in `docs/screenshots/` have dimensions `1730 x 1860`:
   ```bash
   file docs/screenshots/*.png
   ```
2. Visually inspect each generated PNG using `view` to confirm:
   - `01-start.png` shows the full setup header before flight start with `Steering: OFF (Auto-Fly Gates)` and `Auto-Fly Target Gate` checked.
   - `02-flight.png`, `03-delorean.png`, `04-ufo.png`, `04-ufo-topdown.png`, `05-front.png`, and `05-fuchur.png` all show active flight (`PAUSE FLIGHT` button visible, `Auto-Fly Target Gate` checked, forward velocity temporarily set to zero so the avatar is captured before any gate is reached, aligned with the glowing donut gates ahead).
   - `06-summary.png` displays the Workout Complete modal overlay.

### 3. Sync `README.md` Documentation
Review recent changes in `performed3d.html` (e.g., via `git log -n 5` or `git diff`) and ensure `README.md` accurately documents:
- All Screenshot Gallery table entries (`docs/screenshots/01-start.png` through `06-summary.png`).
- Top setup controls, Bluetooth devices (FTMS Smart Trainer, BLE Heart Rate, Zwift Click/Play/Ride steering, Elite Aria smart fan), avatars, camera views, resistance modes, and export formats.
