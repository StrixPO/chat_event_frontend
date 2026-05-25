# AI-First Conversational Event Creation — Frontend

> Phase 2 frontend for the AI-First Event Creation System. A React + Vite application where users create events entirely through conversation — no traditional forms.

**Phase 1 Prototype (Lovable):** [[LOVABLE_URL] ](https://id-preview-5c047dc5--46d72952-7465-4673-8644-127ddce0a5b5.lovable.app/login?redirect=%2F) 
**Backend API:** https://github.com/StrixPO/chat_event_backend  
**Live URL:** [[FRONTEND_LIVE_URL]](https://tanstack-start-app.rusarrp.workers.dev/login?redirect=%2F)

---
## Workflow
<img width="800" height="350" alt="1" src="https://github.com/user-attachments/assets/348b6ad7-4b1b-4638-b728-e18065efbebb" />
<img width="800" height="350" alt="2" src="https://github.com/user-attachments/assets/6d7e550e-f63b-4c0b-a543-a4378e8559f8" />
<img width="800" height="350" alt="3" src="https://github.com/user-attachments/assets/07af4a1b-685c-4bd7-9bad-59ce8eecffc7" />


## What This Is

This is the frontend for a chat-based event management system. Instead of filling out forms, users have a natural conversation with an AI assistant (powered by Gemini 2.5 Flash) that collects all event details conversationally.

The AI asks one question at a time, shows context-aware suggestion chips after every response, validates inputs inline, and creates the event automatically when all fields are collected.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Routing | TanStack Router |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | JWT (via backend API) |
| HTTP Client | Axios |
| Image Upload | Supabase Storage |
| Package Manager | npm |

---

## Prerequisites

- Node.js 18+
- npm
- Backend API running (see [chat_event_backend](https://github.com/StrixPO/chat_event_backend))

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/StrixPO/chat_event_frontend.git
cd chat_event_frontend

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

```bash
# 4. Start development server
npm run dev
```

App runs at `http://localhost:5173`

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | Yes |
| `VITE_SUPABASE_URL` | Supabase URL (for banner image upload only) | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (for banner image upload only) | Yes |

> **Note:** Supabase is used only for banner image file storage. All auth and data operations go through the Node.js backend.

---

## Project Structure

```
src/
├── components/
│   ├── chat/          # Chat UI components (bubbles, chips, input)
│   ├── dashboard/     # Event dashboard and event cards
│   ├── auth/          # Login and signup forms
│   └── ui/            # shadcn/ui base components
├── hooks/             # Custom React hooks
├── lib/
│   ├── api.ts         # Axios client with JWT interceptor
│   └── utils.ts       # Utility functions
├── routes/            # TanStack Router page routes
│   ├── index.tsx      # Chat page (/)
│   ├── login.tsx      # Login page
│   ├── signup.tsx     # Signup page
│   └── dashboard.tsx  # Event dashboard (/dashboard)
├── integrations/
│   └── supabase/      # Supabase client (image upload only)
└── styles.css         # Global styles
```

---

## Key Features

### Conversational Event Creation
- Zero forms — all event data collected through chat
- AI messages on left, user messages on right
- Conversation starts automatically with GDPR consent

### GDPR Consent Flow
The very first interaction is a consent message:
> "Before we begin, your event data will be stored securely. You can request deletion at any time. Do you agree to proceed?"

Users must accept before any data is collected. Declining stops the flow.

### Context-Aware Suggestion Chips
After every AI message, 2–4 relevant quick-reply chips appear:
- Timezone field → shows UTC, Asia/Kathmandu, America/New_York, Europe/London
- Status field → shows Draft, Published, Cancelled
- Roles field → shows Organiser, Speaker, Attendee, Volunteer
- Confirmation → shows "Yes, create it", "Edit something"

Users can tap a chip or type freely.

### Event Dashboard
- All events shown as cards with status badges
- Edit reopens chat pre-filled with that event
- Delete with confirmation dialog
- Status colour-coded: Draft (gray), Published (green), Cancelled (red)

---

## API Integration

All requests go through `src/lib/api.ts`:

```typescript
// Every request automatically includes JWT from localStorage
const res = await api.post('/api/chat/message', {
  sessionId,
  userMessage
});

const { reply, suggestions, eventCreated, eventId } = res.data;
```

On 401 response, the interceptor clears the token and redirects to /login automatically.

---

## Build

```bash
npm run build
```

Output goes to `dist/`. The app is a standard Vite SPA — deploy to any static host.

---

## Phase 1 vs Phase 2

This repo is the **Phase 2** implementation. Phase 1 was built with Lovable (no-code) and is available at:

**https://id-preview-5c047dc5--46d72952-7465-4673-8644-127ddce0a5b5.lovable.app/login?redirect=%2F**

Phase 1 limitations addressed in this codebase:
- Gemini API key moved server-side (was browser-exposed in Phase 1)
- All auth and data through validated backend API (was direct Supabase in Phase 1)
- Audit logging on every action (not present in Phase 1)
- Rate limiting on all endpoints (not present in Phase 1)

---

## License

ISC
