# Inject and Fill

![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest_V3-34A853?style=for-the-badge&logo=google-chrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

A **browser extension** for Chrome, Edge and Brave that automates form filling with custom profiles. It detects form fields and buttons on any web page, lets you map them to specific values, and executes the entire sequence with a single click — supporting text inputs, selects, checkboxes, radio buttons, and button clicks.

---

## Main Features

* **Smart field detection:** Auto-scans inputs, selects, textareas, buttons, and radios. Generates CSS selectors and extracts labels. Detects field types automatically.
* **Visual element picker:** Click ⊕ to pick any form element directly from the page — overlay highlights valid elements in blue, invalid in red, with live feedback.
* **Custom dropdowns:** All selectors use rich HTML dropdowns with bold type tags (`[TEXT]`, `[SELECT]`, `[RADIO]`, `[CHECK]`) and italic values — no native `<select>` elements.
* **Profile management:** Create, edit, delete, and activate profiles. Last 3 used profiles show on the main view with relative timestamps. Persistent via `chrome.storage.local`.
* **Mapping editor:** Drag-and-drop reorder (from `☰` handle), per-action delays, auto-scan on edit, pick from page button.
* **Execution engine:** Sequential (one-by-one with configurable delay) or simultaneous fill, framework simulation (React/Angular/Vue), native value setters, button clicks.
* **Side panel UI:** Always-open panel, "Activo" badge on active profile, toast notifications, configurable settings with descriptions.

---

## Pages & Views

| View | Description |
|------|-------------|
| **Main** | Active profile card with "Activo" badge, recent profiles (horizontal scroll), fill/reload buttons |
| **Profiles** | List all profiles with activate / edit / delete actions |
| **Editor** | Name, description, scan page, map fields with custom dropdowns, per-action delays, drag-and-drop reorder, pick from page |
| **Settings** | Delay between fields with description, sequential mode with explanation of each behavior |

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
4. Click **Escanear pagina** to detect form fields, or use **⊕** to pick elements directly from the page.
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

## Supported Field Types

| Type | Detection | Value Input | Execution |
|------|-----------|-------------|-----------|
| Text / Email / Tel / Number / Password / URL | `<input type="text">` etc. | Free text input or pick from page | `nativeSetter` + `input`/`change` events |
| Select | `<select>` | Custom dropdown with real `<option>` values, placeholder in italic | `.value =` + `change` event |
| Checkbox | `<input type="checkbox">` | Custom dropdown: Marcar ✓ / No marcar ✗ | `.checked =` + `change`/`click` events |
| Radio | `<input type="radio">` | Custom dropdown grouped by `name` | Find by value in group + `change`/`click` |
| Textarea | `<textarea>` | Free text input or pick from page | `nativeSetter` + `input`/`change` events |
| Button | `<button>`, `<input type="submit">`, `[role="button"]` | "Hara click en este elemento" | `.click()` |

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
