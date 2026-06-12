# Inject and Fill

![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest_V3-34A853?style=for-the-badge&logo=google-chrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

A **browser extension** for Chrome, Edge and Brave that automates form filling with custom profiles. It detects form fields and buttons on any web page, lets you map them to specific values, and executes the entire sequence with a single click — supporting text inputs, selects, checkboxes, radio buttons, and button clicks.

---

## Main Features

### Smart Field Detection
* **Automatic scanning:** Detects all `<input>`, `<select>`, `<textarea>`, `<button>`, `<input type="submit">` and `[role="button"]` elements on the active page.
* **Unique selector generation:** Generates robust CSS selectors using `id`, `name`, classes, or `nth-of-type` fallbacks.
* **Label extraction:** Reads `<label>`, `aria-label`, `aria-labelledby`, and parent label text for human-readable field names.
* **Auto field type detection:** Identifies text, email, select, checkbox, radio, and button types automatically.

### Intelligent Value Mapping
* **Select fields:** Shows actual `<option>` values from the page — no guesswork, no invalid values.
* **Radio buttons:** Groups radios by `name` into a single entry with a dropdown of all available options.
* **Checkboxes:** Clear "Marcar / Desmarcar" options.
* **Buttons:** Detected and available as `[Click]` actions in the sequence.
* **Text fields:** Free-form input for any text, email, number, password, etc.

### Profile Management
* **Create, edit, delete profiles:** Each profile stores a named sequence of field mappings.
* **Activate any profile:** One-click activation from the popup.
* **Persistent storage:** Profiles survive browser restarts via `chrome.storage.local`.
* **Auto-scan on edit:** When editing a profile, the extension automatically scans the page to populate field dropdowns.

### Execution Engine
* **Sequential execution:** Fills fields one by one with configurable delay (default 200ms) for framework compatibility.
* **Parallel execution:** Option to fill all fields simultaneously.
* **Framework simulation:** Dispatches `input`, `change`, `keydown`, `keyup` events for React, Angular and Vue compatibility.
* **Native value setters:** Uses prototype property descriptors to bypass framework value trapping.
* **Button clicks:** Executes `element.click()` on mapped buttons as part of the sequence.

### Popup Interface
* **Compact 360px popup:** Clean, dark-themed UI that opens on extension icon click.
* **View-based navigation:** Main view, profiles list, profile editor, and settings.
* **Real-time feedback:** Toast notifications for success/error states.
* **Configurable delay:** Adjustable delay between actions (0–5000ms).

---

## Pages & Views

| View | Description |
|------|-------------|
| **Main** | Shows active profile name and "Rellenar Formulario" button |
| **Profiles** | List all profiles with activate / edit / delete actions |
| **Editor** | Name, description, scan page, map fields with dropdowns |
| **Settings** | Delay between fields, sequential mode toggle |

---

## Execution and Development Guide

This project is a Chrome Extension (Manifest V3). To run it locally you only need Google Chrome or any Chromium-based browser.

### 1. Clone the repository

```bash
git clone https://github.com/user/inject-and-fill.git
cd inject-and-fill
```

### 2. Load the extension in Chrome

1. Open `chrome://extensions/` in your browser.
2. Enable **Modo desarrollador** (Developer mode) in the top right corner.
3. Click **Cargar extensión sin empaquetar** (Load unpacked).
4. Select the `inject-and-fill` folder.

### 3. Use the extension

1. Navigate to any page with a form.
2. Click the extension icon to open the popup.
3. Go to **Gestionar** → **+** to create a new profile.
4. Click **Escanear pagina** to detect form fields and buttons.
5. Select fields from the dropdown and assign values.
6. Save and activate the profile.
7. Click **Rellenar Formulario** to execute.

---

## Project Structure

```text
inject-and-fill/
│
├── manifest.json                  ← Manifest V3 configuration
├── generate-icons.js              ← Icon generation script (Node.js)
│
├── icons/                         ← Extension icons (16, 48, 128 px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── background/                    ← Service Worker
│   └── background.js              ← Message routing, tab actions, content script injection
│
├── content/                       ← Content Script (injected into web pages)
│   └── content.js                 ← Field detection, form filling, button clicking, event simulation
│
└── popup/                         ← Extension popup UI
    ├── popup.html                 ← Main popup markup
    ├── popup.css                  ← Dark-themed popup styles
    ├── popup.js                   ← View navigation, profile CRUD, scan/fill logic
    └── storage.js                 ← chrome.storage.local abstraction
```

---

## Architecture

```text
┌─────────────┐       chrome.runtime       ┌──────────────┐      chrome.tabs      ┌────────────────┐
│   Popup UI  │ ────── sendMessage() ─────▶│   Background │ ──── sendMessage() ──▶│ Content Script │
│  (popup.js) │ ◀────── response ──────────│ (background) │ ◀───── response ──────│ (content.js)   │
└─────────────┘                            └──────────────┘                       └────────────────┘
                                                  │                                        │
                                          chrome.scripting                          DOM manipulation
                                           .executeScript()                     querySelector, .click()
                                          (inject if needed)                    dispatchEvent, .value=
```

### Message Flow

1. **Popup** sends `{ action: 'detectFields' }` or `{ action: 'fillFields', fields, sequential, delay }` to background.
2. **Background** queries the active tab, injects the content script if needed via `chrome.scripting.executeScript`, and forwards the message.
3. **Content Script** executes the action (detect fields, fill form, click button) and sends the response back.
4. **Background** relays the response to the popup.

---

## Supported Field Types

| Type | Detection | Value Input | Execution |
|------|-----------|-------------|-----------|
| Text / Email / Tel / Number / Password / URL | `<input type="text">` etc. | Free text input | `nativeSetter` + `input`/`change` events |
| Select | `<select>` | Dropdown with real `<option>` values | `.value =` + `change` event |
| Checkbox | `<input type="checkbox">` | Marcar / Desmarcar | `.checked =` + `change`/`click` events |
| Radio | `<input type="radio">` | Dropdown grouped by `name` | Find by value in group + `change`/`click` |
| Textarea | `<textarea>` | Free text input | `nativeSetter` + `input`/`change` events |
| Button | `<button>`, `<input type="submit">`, `[role="button"]` | "Hara click en este elemento" | `.click()` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension API | Chrome Manifest V3 |
| Background | Service Worker (`background.js`) |
| Content Script | Vanilla JavaScript, DOM API |
| Popup UI | Vanilla HTML/CSS/JS |
| Storage | `chrome.storage.local` |
| Script Injection | `chrome.scripting.executeScript` |
| Tab Actions | `chrome.tabs.reload`, `chrome.tabs.update` |

---

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save profiles and settings |
| `activeTab` | Access the current active tab |
| `tabs` | Query and manipulate browser tabs |
| `scripting` | Inject content script on-demand |

---

## Authors

* **Arias Tenjo Camilo Andres**

*Browser Extension Development*
