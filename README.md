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
* **Select fields:** Shows actual `<option>` values from the page via custom dropdowns — no guesswork, no invalid values.
* **Radio buttons:** Groups radios by `name` into a single entry with a custom dropdown of all available options.
* **Checkboxes:** Clear "Check / Uncheck" custom dropdown options.
* **Buttons:** Detected and available as `[Click]` actions in the sequence.
* **Text fields:** Free-form input for any text, email, number, password, etc.

### Custom Dropdown Component
All dropdowns throughout the UI use a custom HTML component (no native `<select>` elements) featuring:
* **Rich HTML options:** Bold type tags (`[TEXT]`, `[SELECT]`, `[RADIO]`, `[CHECK]`) with italic values.
* **Text overflow:** Truncation with ellipsis for long field names or values.
* **Consistent styling:** Dark-themed, keyboard-friendly, matches the rest of the UI.

### Profile Management
* **Create, edit, delete profiles:** Each profile stores a named sequence of field mappings.
* **Activate any profile:** One-click activation from the side panel or from recent profiles.
* **Persistent storage:** Profiles survive browser restarts via `chrome.storage.local`.
* **Auto-scan on edit:** When editing a profile, the extension automatically scans the page to populate field dropdowns.
* **Recent profiles:** The last 3 used profiles appear on the main view with relative timestamps (e.g., "hace 5 min") for quick switching.

### Mapping Editor
* **Drag-and-drop reorder:** Reorder field actions by dragging from the `☰` handle or using the up/down buttons.
* **Per-action delays:** Each mapping can have its own delay (ms) that overrides the global delay for fine-grained control.
* **Inline type badges:** Bold type tags on every option make it easy to distinguish text fields from selects, radios, and buttons.

### Execution Engine
* **Sequential execution:** Fills fields one by one with configurable delay (default 200ms) for framework compatibility.
* **Parallel execution:** Option to fill all fields simultaneously.
* **Framework simulation:** Dispatches `input`, `change`, `keydown`, `keyup` events for React, Angular and Vue compatibility.
* **Native value setters:** Uses prototype property descriptors to bypass framework value trapping.
* **Button clicks:** Executes `element.click()` on mapped buttons as part of the sequence.

### Side Panel Interface
* **Always-open side panel:** Stays open while you navigate pages, no need to reopen the popup.
* **View-based navigation:** Main view, profiles list, profile editor, and settings.
* **Main view at a glance:** Shows the active profile with an "Activo" badge, the last 3 used profiles, and action buttons.
* **Real-time feedback:** Toast notifications for success/error states.
* **Configurable delay:** Adjustable delay between actions (0–5000ms).

---

## Pages & Views

| View | Description |
|------|-------------|
| **Main** | Active profile card with "Activo" badge, recent profiles (horizontal scroll), fill/reload buttons |
| **Profiles** | List all profiles with activate / edit / delete actions |
| **Editor** | Name, description, scan page, map fields with custom dropdowns, per-action delays, drag-and-drop reorder |
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
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `inject-and-fill` folder.

### 3. Use the extension

1. Navigate to any page with a form.
2. Click the extension icon to open the side panel.
3. Go to **Gestionar Perfiles** → **+** to create a new profile.
4. Click **Escanear pagina** to detect form fields and buttons.
5. Select fields from the custom dropdown and assign values.
6. Save and activate the profile.
7. Click **Rellenar Formulario** to execute.

> **Note:** After loading the extension, reload the target page once for the content script to register properly.

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
└── sidepanel/                     ← Extension side panel UI
    ├── sidepanel.html             ← Main side panel markup
    ├── sidepanel.css              ← Dark-themed side panel styles
    ├── sidepanel.js               ← View navigation, profile CRUD, custom dropdowns, drag-and-drop, scan/fill logic
    └── storage.js                 ← chrome.storage.local abstraction
```

---

## Architecture

```text
┌──────────────────┐      chrome.runtime       ┌──────────────┐      chrome.tabs      ┌────────────────┐
│  Side Panel UI   │ ──── sendMessage() ──────▶│   Background │ ──── sendMessage() ──▶│ Content Script │
│ (sidepanel.js)   │ ◀────── response ─────────│ (background) │ ◀───── response ──────│ (content.js)   │
└──────────────────┘                           └──────────────┘                       └────────────────┘
                                                     │                                        │
                                             chrome.scripting                          DOM manipulation
                                              .executeScript()                     querySelector, .click()
                                            (inject if needed)                    dispatchEvent, .value=
```

### Message Flow

1. **Side Panel** sends `{ action: 'detectFields' }` or `{ action: 'fillFields', fields, sequential, delay }` to background.
2. **Background** queries the active tab, injects the content script if needed via `chrome.scripting.executeScript`, and forwards the message.
3. **Content Script** executes the action (detect fields, fill form, click button) and sends the response back.
4. **Background** relays the response to the side panel.

---

## Supported Field Types

| Type | Detection | Value Input | Execution |
|------|-----------|-------------|-----------|
| Text / Email / Tel / Number / Password / URL | `<input type="text">` etc. | Free text input | `nativeSetter` + `input`/`change` events |
| Select | `<select>` | Custom dropdown with real `<option>` values | `.value =` + `change` event |
| Checkbox | `<input type="checkbox">` | Custom dropdown: Checked / Unchecked | `.checked =` + `change`/`click` events |
| Radio | `<input type="radio">` | Custom dropdown grouped by `name` | Find by value in group + `change`/`click` |
| Textarea | `<textarea>` | Free text input | `nativeSetter` + `input`/`change` events |
| Button | `<button>`, `<input type="submit">`, `[role="button"]` | "Will click on this element" | `.click()` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension API | Chrome Manifest V3 |
| Background | Service Worker (`background.js`) |
| Content Script | Vanilla JavaScript, DOM API |
| Side Panel UI | Vanilla HTML/CSS/JS, custom dropdown component |
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
| `sidePanel` | Open the side panel on extension icon click |

---

## Authors

* **Arias Tenjo Camilo Andres**

*Browser Extension Development*
