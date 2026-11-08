# Performed 3D

Performed 3D is a browser-based 3D cycling game for structured indoor cycling workouts. A workout profile sets power targets; power from a connected trainer is measured and its resistance is controlled according to the selected mode. At the same time, an avatar flies through an animated sky filled with donut gates. Optionally, you can shoot obstacles and steer manually.

![Start screen with workout selection and settings](docs/screenshots/01-start.png)

## Quick start

There is no build step or package installation. The page loads Three.js and Tailwind CSS at runtime from CDNs, so an internet connection is required.

1. Clone or download the repository.
2. Start a local web server from the project directory:

   ```bash
   python3 -m http.server 8000
   ```

3. Open <http://localhost:8000/performed3d.html> in your browser.
4. Choose a workout and resistance mode, set your FTP and accuracy, then click **Start Flight**.

Simulation mode is enabled by default, so you can try the game without a trainer. Bluetooth requires a compatible browser; the Web Bluetooth API is supported by browsers such as current versions of Chrome and Edge. Bluetooth is available only in a secure context (for example, `localhost` or HTTPS).

## Gameplay and workout controls

Your current power is compared with the workout's target power. The game displays power accuracy, workout intervals, and progress in the HUD. FTP (250 W by default; adjustable from 50 to 600 W) is used to calculate power targets specified as a percentage of FTP. Use **Donut / Accuracy** to set the allowed power deviation.

Available workouts include:

- **KICKR Arcade Pyramid** and **Quick 3-Minute Accuracy Sprint** for short accuracy challenges
- Ramp and elevation profiles such as **Sky Serpent**, **Alpine Switchback**, **Mach Canyon**, and **Dragon Boss Mega-Ramp**
- Interval workouts such as **30/15 VO2max Micro-Burst Storm**, **Dragon Fire Tabata Inferno**, and **Over-Under Surge Blitz**
- Longer profiles such as **Harmonic Wave & Step Matrix**, **Sweet Spot Precision**, and **Pro Criterium Corner Sprints**
- Custom Zwift workouts in `.zwo` format

Resistance modes are **Easy**, **Medium**, **Difficult**, and **ERG Lock**. Use **Next Block** to skip to the next interval. **Start Flight** pauses or resumes the workout. You can also end a workout early.

## Controls

| Key | Action |
| --- | --- |
| `←` / `A` | Steer left |
| `→` / `D` | Steer right |
| `1`–`5` | Change camera view |
| `Space` | Breathe dragon fire to fend off obstacles |
| `↑` / `↓` | Increase/decrease power by 10 W in simulation mode |
| `Shift` + `↑` / `↓` | Increase/decrease power by 25 W in simulation mode |

You can turn off manual steering to have the avatar automatically steer through the gates. The left, right, and center buttons in the compact control bar are alternatives to the keyboard. Obstacles can be enabled or disabled with the corresponding option.

## Avatars and cameras

Available avatars:

- Aero Wyvern
- Fuchur
- Boy with Bicycle & E.T.
- DeLorean
- UFO

There are five camera views: Chase, Far Chase, Top-Down, Front, and Front Far. Your avatar, camera, FTP, steering, and accuracy settings are saved in the browser.

## Connecting trainers and sensors

Use the BLE buttons to pair supported devices:

- Wahoo KICKR (power and trainer control)
- Heart rate monitors
- Cadence and speed sensors
- Elite Sterzo Smart or Elite Rizer (steering)
- Elite Aria Smart Fan

Bluetooth devices must be powered on and within range. Start pairing from the corresponding control in the interface. Without a trainer, use simulation mode; power can be adjusted with the slider or arrow keys.

## Custom workouts and results

- **Load a Zwift workout:** Select a `.zwo` file using **Upload Zwift (.zwo)**. Supported interval types include SteadyState, Warmup, Cooldown, Ramp, IntervalsT, FreeRide, and MaxEffort.
- **Save a FIT file:** After the workout, download the recorded activity as a `.fit` file from the summary.
- **Save a screenshot:** Capture a screenshot before or during a workout; it will be available to download from the summary.

## Screenshots

| View | Screenshot |
| --- | --- |
| Flight | ![Flight through the 3D gates](docs/screenshots/02-flight.png) |
| DeLorean avatar | ![DeLorean in flight](docs/screenshots/03-delorean.png) |
| UFO, standard view | ![UFO in flight](docs/screenshots/04-ufo.png) |
| UFO, top-down view | ![UFO from the top-down camera](docs/screenshots/04-ufo-topdown.png) |
| Front camera | ![Front view](docs/screenshots/05-front.png) |
| Fuchur avatar | ![Fuchur in flight](docs/screenshots/05-fuchur.png) |
| Workout summary | ![Workout summary](docs/screenshots/06-summary.png) |

## Project files

- [`performed3d.html`](performed3d.html) – User interface, game, workout logic, and Bluetooth integration
- [`performed3d-models.js`](performed3d-models.js) – 3D models
- [`sterzo-challenge-codes.js`](sterzo-challenge-codes.js) – Sterzo challenge/response table; the source code attributes it to `pycycling` under the MIT license
- [`performed3d.svg`](performed3d.svg) – Logo and favicon
- [`docs/screenshots/`](docs/screenshots/) – Documentation screenshots
