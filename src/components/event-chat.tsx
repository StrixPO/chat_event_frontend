import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Send, Upload, Loader2, ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { eventChatStep } from "@/lib/event-chat.functions";
import { useServerFn } from "@tanstack/react-start";

type Role = "assistant" | "user" | "system";
type Message = {
  id: string;
  role: Role;
  content: string;
  ts: number;
};

type Mode = "consent" | "declined" | "collecting" | "ask_edit" | "confirming" | "editing_field" | "done";

type Collected = {
  event_name?: string;
  subheading?: string;
  description?: string;
  banner_image_url?: string;
  timezone?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  vanish_date?: string;
  roles?: string[];
};

type State = {
  mode: Mode;
  fieldIndex: number;
  collected: Collected;
  suggestions: string[];
  eventId?: string;
};

const FIELDS = [
  "event_name",
  "subheading",
  "description",
  "banner_image_url",
  "timezone",
  "status",
  "start_date",
  "end_date",
  "vanish_date",
  "roles",
] as const;
type FieldKey = (typeof FIELDS)[number];

const FIELD_LABELS: Record<FieldKey, string> = {
  event_name: "Event Name",
  subheading: "Subheading",
  description: "Description",
  banner_image_url: "Banner Image",
  timezone: "Time Zone",
  status: "Status",
  start_date: "Start Date",
  end_date: "End Date",
  vanish_date: "Vanish Date",
  roles: "Roles",
};

const TIMEZONES = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Kathmandu"];
const STATUSES = ["Draft", "Published", "Cancelled"];
const DEFAULT_ROLES = ["Organiser", "Speaker", "Attendee", "Volunteer"];

const CONSENT_TEXT =
  "Before we begin, your event data will be stored securely. You can request deletion at any time. Do you agree to proceed?";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function msg(role: Role, content: string): Message {
  return { id: uid(), role, content, ts: Date.now() };
}

function formatValue(field: FieldKey, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "roles" && Array.isArray(value)) return value.join(", ") || "—";
  if (field === "banner_image_url") return "(uploaded)";
  if (field === "start_date" || field === "end_date" || field === "vanish_date") {
    try {
      return new Date(value as string).toLocaleString();
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventChat({ sessionId: sessionIdProp }: { sessionId?: string } = {}) {
  const navigate = useNavigate();
  const callAi = useServerFn(eventChatStep);

  const [sessionId, setSessionId] = useState<string | null>(
    sessionIdProp && !sessionIdProp.startsWith("new-") ? sessionIdProp : null,
  );
  const editingEventId = useMemo(
    () => (sessionIdProp?.startsWith("new-") ? sessionIdProp.slice(4) : undefined),
    [sessionIdProp],
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<State>({
    mode: "consent",
    fieldIndex: 0,
    collected: {},
    suggestions: ["I agree", "I decline"],
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Hydrate from existing session or seed a new one
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sessionIdProp && !sessionIdProp.startsWith("new-")) {
        const { data } = await supabase
          .from("chat_sessions")
          .select("messages,state,event_id")
          .eq("id", sessionIdProp)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setMessages((data.messages as Message[]) ?? []);
          setState((data.state as State) ?? state);
        }
        setHydrated(true);
        return;
      }
      // New session: if editingEventId, prefill collected from the event
      if (editingEventId) {
        const { data: ev } = await supabase.from("events").select("*").eq("id", editingEventId).maybeSingle();
        if (cancelled) return;
        if (ev) {
          const collected: Collected = {
            event_name: ev.event_name ?? undefined,
            subheading: ev.subheading ?? undefined,
            description: ev.description ?? undefined,
            banner_image_url: ev.banner_image_url ?? undefined,
            timezone: ev.timezone ?? undefined,
            status: ev.status ?? undefined,
            start_date: ev.start_date ?? undefined,
            end_date: ev.end_date ?? undefined,
            vanish_date: ev.vanish_date ?? undefined,
            roles: (ev.roles as string[] | null) ?? undefined,
          };
          setState({
            mode: "ask_edit",
            fieldIndex: 0,
            collected,
            suggestions: FIELDS.filter((f) => collected[f] != null).slice(0, 4).map((f) => FIELD_LABELS[f]),
            eventId: ev.id,
          });
          setMessages([
            msg(
              "assistant",
              `Editing "${ev.event_name ?? "your event"}". Which field would you like to change?`,
            ),
          ]);
          setHydrated(true);
          return;
        }
      }
      setMessages([msg("assistant", CONSENT_TEXT)]);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdProp, editingEventId]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // Focus input
  useEffect(() => {
    if (!busy && hydrated) inputRef.current?.focus();
  }, [busy, hydrated, state.mode, state.fieldIndex]);

  // Persist to supabase (after every change once we have messages)
  useEffect(() => {
    if (!hydrated || messages.length === 0 || state.mode === "consent" || state.mode === "declined") return;
    const t = setTimeout(async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      if (!sessionId) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: userId,
            messages: messages as unknown as never,
            state: state as unknown as never,
            event_id: state.eventId ?? null,
          })
          .select("id")
          .single();
        if (!error && data) setSessionId(data.id);
      } else {
        await supabase
          .from("chat_sessions")
          .update({
            messages: messages as unknown as never,
            state: state as unknown as never,
            event_id: state.eventId ?? null,
          })
          .eq("id", sessionId);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [messages, state, hydrated, sessionId]);

  // ===== Flow helpers =====

  const currentField = (): FieldKey | undefined => {
    if (state.mode === "collecting" && state.fieldIndex < FIELDS.length) return FIELDS[state.fieldIndex];
    if (state.mode === "editing_field") {
      // editingField stored in suggestions? No — we'll stash via fieldIndex pointing to that field
      return FIELDS[state.fieldIndex];
    }
    return undefined;
  };

  const appendAssistant = async (mode: Parameters<typeof callAi>[0]["data"]["mode"], opts: {
    currentField?: FieldKey;
    previousField?: FieldKey;
    userInput?: string;
    collected: Collected;
  }) => {
    setBusy(true);
    try {
      const res = await callAi({
        data: {
          mode,
          currentField: opts.currentField,
          previousField: opts.previousField,
          userInput: opts.userInput,
          collected: opts.collected as Record<string, unknown>,
        },
      });
      setMessages((m) => [...m, msg("assistant", res.message)]);
      return res.suggestions;
    } catch (err) {
      const fallback = "Let's keep going.";
      setMessages((m) => [...m, msg("assistant", fallback)]);
      toast.error(err instanceof Error ? err.message : "AI request failed");
      return ["Continue"];
    } finally {
      setBusy(false);
    }
  };

  const advanceToNextField = async (justCollected: FieldKey | undefined, value: unknown, collected: Collected) => {
    const next = collected;
    // find next unfilled-or-next index
    let nextIdx = (justCollected ? FIELDS.indexOf(justCollected) : -1) + 1;
    // skip already-collected fields when at the end of editing? we still want sequential collection
    if (nextIdx >= FIELDS.length) {
      // Done collecting → confirm
      const suggestions = await appendAssistant("confirm_summary", { collected: next });
      // Add summary card pseudo-message? We render summary inline based on mode.
      setState((s) => ({ ...s, mode: "confirming", collected: next, suggestions }));
      return;
    }
    const nextField = FIELDS[nextIdx];
    const suggestions = await appendAssistant("acknowledge_and_ask", {
      currentField: nextField,
      previousField: justCollected,
      userInput: value == null ? "" : String(value),
      collected: next,
    });
    setState((s) => ({
      ...s,
      mode: "collecting",
      fieldIndex: nextIdx,
      collected: next,
      suggestions: defaultSuggestionsFor(nextField) ?? suggestions,
    }));
  };

  const defaultSuggestionsFor = (field: FieldKey): string[] | undefined => {
    if (field === "subheading") return ["Skip", "Add a tagline"];
    if (field === "timezone") return TIMEZONES;
    if (field === "status") return STATUSES;
    if (field === "roles") return DEFAULT_ROLES;
    return undefined;
  };

  const startCollecting = async (collected: Collected) => {
    const suggestions = await appendAssistant("ask_field", {
      currentField: "event_name",
      collected,
    });
    setState({
      mode: "collecting",
      fieldIndex: 0,
      collected,
      suggestions: defaultSuggestionsFor("event_name") ?? suggestions,
    });
  };

  // ===== Action handlers =====

  const handleConsentAgree = async () => {
    setMessages((m) => [...m, msg("user", "I agree")]);
    await startCollecting({});
  };

  const handleConsentDecline = () => {
    setMessages((m) => [
      ...m,
      msg("user", "I decline"),
      msg(
        "assistant",
        "No problem — we won't store anything. You can come back anytime and tap “I agree” to start.",
      ),
    ]);
    setState((s) => ({ ...s, mode: "declined", suggestions: [] }));
  };

  const submitValue = async (rawValue: string, opts?: { silent?: boolean }) => {
    const field = currentField();
    if (!field) return;
    const isOptional = field === "subheading";
    if (!rawValue && !isOptional) return;

    if (!opts?.silent) {
      setMessages((m) => [...m, msg("user", rawValue || "(skipped)")]);
    }

    const value: unknown = field === "roles" ? rawValue.split(",").map((s) => s.trim()).filter(Boolean) : rawValue;
    const collected: Collected = { ...state.collected, [field]: value === "" ? undefined : value };

    if (state.mode === "editing_field") {
      // back to confirming
      const suggestions = await appendAssistant("edit_complete", {
        previousField: field,
        collected,
      });
      setState((s) => ({
        ...s,
        mode: "confirming",
        collected,
        suggestions: ["Yes, create it", "Edit something"].length ? ["Yes, create it", "Edit something"] : suggestions,
      }));
      return;
    }

    await advanceToNextField(field, value, collected);
  };

  const submitDate = async (iso: string) => {
    if (!iso) return;
    await submitValue(new Date(iso).toISOString());
  };

  const submitRoles = async (selected: string[]) => {
    await submitValue(selected.join(","));
  };

  const handleImageFile = async (file: File) => {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${uid()}.${ext}`;
      const { error } = await supabase.storage.from("event-banners").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("event-banners").getPublicUrl(path);
      setMessages((m) => [...m, msg("user", `Uploaded: ${file.name}`)]);
      await submitValue(pub.publicUrl, { silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCreate = async () => {
    setBusy(true);
    try {
      setMessages((m) => [...m, msg("user", "Yes, create it")]);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const c = state.collected;
      const payload = {
        user_id: userId,
        event_name: c.event_name ?? null,
        subheading: c.subheading ?? null,
        description: c.description ?? null,
        banner_image_url: c.banner_image_url ?? null,
        timezone: c.timezone ?? null,
        status: c.status ?? "Draft",
        start_date: c.start_date ?? null,
        end_date: c.end_date ?? null,
        vanish_date: c.vanish_date ?? null,
        roles: (c.roles ?? []) as unknown as never,
      };
      let eventId = state.eventId;
      if (eventId) {
        const { error } = await supabase.from("events").update(payload).eq("id", eventId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert(payload).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }
      setMessages((m) => [
        ...m,
        msg("assistant", "Your event is saved. You can find it on the dashboard."),
      ]);
      setState((s) => ({ ...s, mode: "done", suggestions: [], eventId }));
      toast.success("Event saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleEditRequest = async () => {
    setMessages((m) => [...m, msg("user", "Edit something")]);
    const suggestions = await appendAssistant("ask_edit_target", { collected: state.collected });
    const collectedKeys = FIELDS.filter((f) => state.collected[f] != null);
    setState((s) => ({
      ...s,
      mode: "ask_edit",
      suggestions: collectedKeys.slice(0, 4).map((f) => FIELD_LABELS[f]).length
        ? collectedKeys.slice(0, 4).map((f) => FIELD_LABELS[f])
        : suggestions,
    }));
  };

  const handlePickEditTarget = async (label: string) => {
    const field = (Object.keys(FIELD_LABELS) as FieldKey[]).find((k) => FIELD_LABELS[k] === label);
    if (!field) {
      setMessages((m) => [...m, msg("assistant", "I didn't recognize that field. Tap one of the chips.")]);
      return;
    }
    setMessages((m) => [...m, msg("user", label)]);
    const suggestions = await appendAssistant("ask_field", {
      currentField: field,
      collected: state.collected,
    });
    setState((s) => ({
      ...s,
      mode: "editing_field",
      fieldIndex: FIELDS.indexOf(field),
      suggestions: defaultSuggestionsFor(field) ?? suggestions,
    }));
  };

  // ===== Suggestion-chip click =====
  const onChipClick = (label: string) => {
    if (state.mode === "consent") {
      if (label === "I agree") return handleConsentAgree();
      if (label === "I decline") return handleConsentDecline();
    }
    if (state.mode === "confirming") {
      if (label.toLowerCase().startsWith("yes")) return handleConfirmCreate();
      if (label.toLowerCase().startsWith("edit")) return handleEditRequest();
    }
    if (state.mode === "ask_edit") {
      return handlePickEditTarget(label);
    }
    if (state.mode === "collecting" || state.mode === "editing_field") {
      const f = currentField();
      if (f === "subheading" && label.toLowerCase() === "skip") return submitValue("");
      if (f === "roles") {
        // toggling roles handled in the dedicated widget; clicking a chip submits single-role list
        return submitValue(label);
      }
      return submitValue(label);
    }
  };

  // ===== Text submit =====
  const onTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v || busy) return;
    setInput("");
    if (state.mode === "consent") {
      if (/agree|yes|ok/i.test(v)) return handleConsentAgree();
      if (/decline|no/i.test(v)) return handleConsentDecline();
      setMessages((m) => [...m, msg("user", v), msg("assistant", "Please tap “I agree” or “I decline” to continue.")]);
      return;
    }
    if (state.mode === "confirming") {
      if (/^y/i.test(v)) return handleConfirmCreate();
      if (/edit/i.test(v)) return handleEditRequest();
    }
    if (state.mode === "ask_edit") {
      return handlePickEditTarget(v);
    }
    if (state.mode === "collecting" || state.mode === "editing_field") {
      return submitValue(v);
    }
  };

  // ===== Render =====
  const field = currentField();
  const showImageUpload = (state.mode === "collecting" || state.mode === "editing_field") && field === "banner_image_url";
  const showDatePicker =
    (state.mode === "collecting" || state.mode === "editing_field") &&
    (field === "start_date" || field === "end_date" || field === "vanish_date");
  const showRolesPicker = (state.mode === "collecting" || state.mode === "editing_field") && field === "roles";

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-2xl flex-col px-3 sm:px-6">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {state.mode === "confirming" ? <SummaryCard collected={state.collected} /> : null}

          {state.mode === "done" ? (
            <div className="flex justify-start">
              <Card className="flex max-w-[85%] items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <Button variant="link" className="h-auto p-0" onClick={() => navigate({ to: "/dashboard" })}>
                  Go to dashboard
                </Button>
              </Card>
            </div>
          ) : null}

          {busy ? (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          ) : null}
        </div>
      </div>

      {/* Inline widgets */}
      {showImageUpload ? <ImageUploader onFile={handleImageFile} disabled={busy} /> : null}
      {showDatePicker ? <DateTimePicker onSubmit={submitDate} disabled={busy} /> : null}
      {showRolesPicker ? <RolesPicker disabled={busy} onSubmit={submitRoles} /> : null}

      {/* Suggestion chips */}
      {state.mode !== "declined" && state.mode !== "done" && state.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 py-2">
          {state.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onChipClick(s)}
              disabled={busy}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* Composer */}
      {state.mode !== "declined" && state.mode !== "done" ? (
        <form onSubmit={onTextSubmit} className="sticky bottom-0 mt-2 flex items-end gap-2 border-t border-border bg-background py-3">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              state.mode === "consent"
                ? "Tap a chip above…"
                : showImageUpload
                  ? "Upload a banner above, or type a URL…"
                  : "Type your reply…"
            }
            rows={1}
            className="max-h-32 min-h-10 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onTextSubmit(e as unknown as FormEvent);
              }
            }}
            disabled={busy}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function MessageBubble({ role, content }: { role: Role; content: string }) {
  if (role === "system") return null;
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-sky-100 text-sky-950" : "bg-muted text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}

function SummaryCard({ collected }: { collected: Collected }) {
  return (
    <div className="flex justify-start">
      <Card className="w-full max-w-[95%] p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Event summary</div>
        <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-[140px_1fr]">
          {FIELDS.map((f) => (
            <div key={f} className="contents">
              <dt className="text-xs text-muted-foreground sm:text-sm">{FIELD_LABELS[f]}</dt>
              <dd className="break-words text-sm">{formatValue(f, collected[f])}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function ImageUploader({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex items-center gap-2 py-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => ref.current?.click()}>
        <Upload className="h-4 w-4" /> Upload banner
      </Button>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <ImageIcon className="h-3 w-3" /> PNG or JPG
      </span>
    </div>
  );
}

function DateTimePicker({ onSubmit, disabled }: { onSubmit: (iso: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2 py-2">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={disabled}
      />
      <Button
        type="button"
        size="sm"
        disabled={disabled || !value}
        onClick={() => {
          if (!value) return;
          onSubmit(new Date(value).toISOString());
          setValue("");
        }}
      >
        Set
      </Button>
    </div>
  );
}

function RolesPicker({ onSubmit, disabled }: { onSubmit: (selected: string[]) => void; disabled?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const toggle = (r: string) =>
    setSelected((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) setSelected([...selected, v]);
    setCustom("");
  };
  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap gap-2">
        {[...DEFAULT_ROLES, ...selected.filter((s) => !DEFAULT_ROLES.includes(s))].map((r) => {
          const active = selected.includes(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              disabled={disabled}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-sky-300 bg-sky-100 text-sky-950"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {r}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a custom role…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />
        <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={disabled}>
          Add
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || selected.length === 0}
          onClick={() => {
            onSubmit(selected);
            setSelected([]);
          }}
        >
          Done
        </Button>
      </div>
      {selected.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          Selected: {selected.map((r) => <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>)}
        </div>
      ) : null}
    </div>
  );
}
