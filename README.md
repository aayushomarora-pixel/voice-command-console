# Voice Command Console

Voice Command Console is a browser-native assistant for turning spoken requests into clear actions. It uses the Web Speech API for microphone input and sends only the completed transcript to a server-side Claude intent parser. The browser never receives an LLM credential.

## Features

The console supports five actions: opening a normalized URL, saving a note to browser-local storage, launching a Google web search, setting a session reminder, and reporting the current local time. Every completed request appears in the chronological action history with its transcript, recognized action, outcome, and local timestamp.

The interface exposes idle, listening, processing, success, and error states. The transcript is announced through an `aria-live` region, the microphone control is keyboard reachable, and unsupported browsers or microphone failures receive an explicit explanation.

## Local setup

Install Node.js 20 or newer and pnpm, then install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by the development server. Use HTTPS or localhost so the browser can request microphone permission. If the browser asks for access, choose Allow.

## Claude configuration

The server uses the managed LLM integration already available to this project and requests the `claude-sonnet-4-6` model with strict JSON Schema output. No Claude key is placed in React code, exposed to the browser, or committed to source control. In another environment, provide the platform's server-side LLM credentials according to that environment's secret manager; do not add them to `VITE_*` variables.

The intent contract is validated with Zod before the client receives it. This gives the UI a small, predictable action vocabulary rather than executing arbitrary model text.

## Supported commands

| Action | Example command | Browser behavior |
| --- | --- | --- |
| Open URL | “Open github.com” | Opens a normalized `https://` URL in a new tab |
| Take note | “Take a note that the demo starts at nine” | Saves the note in browser-local storage |
| Search web | “Search the web for Web Speech API examples” | Opens a Google search in a new tab |
| Set reminder | “Remind me in ten minutes to check the build” | Shows a browser-session toast after the requested delay |
| Tell time | “What time is it?” | Reports the current time in the browser's local timezone |

Reminders are intentionally session-based in this hackathon build. They do not persist after the tab or browser process is closed.

## Browser requirements

Web Speech API support varies by browser and operating system. Current Chrome or Edge desktop releases are recommended; Safari may support the feature depending on version and platform. The app detects unavailable speech recognition and explains how to continue. Microphone permission and a secure context are required.

## Deployment

This repository is configured for managed deployment. Create a checkpoint after verifying the build, then use the project's **Publish** control in the management interface. The generated HTTPS URL can be shared with judges. Before the demo, open the deployed URL in a supported browser, grant microphone permission, and test one command from each action category.

## Verification

```bash
pnpm check
pnpm test
pnpm build
```
