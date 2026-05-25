import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Send, Upload, Loader2, ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

type Role = "assistant" | "user";
type Message = {
  id: string;
  role: Role;
  content: string;
  ts: number;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function msg(role: Role, content: string): Message {
  return { id: uid(), role, content, ts: Date.now() };
}

export function EventChat({ sessionId: sessionIdProp }: { sessionId?: string } = {}) {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string>(() => {
    if (sessionIdProp && !sessionIdProp.startsWith("new-")) return sessionIdProp;
    return crypto.randomUUID?.() ?? uid();
  });
  const [messages, setMessages] = useState<Message[]>([
    msg("assistant", "Welcome! Send a message to begin building your event."),
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Tell me about my event",
    "I need help with a banner",
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [eventCreated, setEventCreated] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || busy) return;

    const userMsg = msg("user", userMessage);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const payload: { sessionId?: string; userMessage: string } = { userMessage };
      if (sessionIdProp && !sessionIdProp.startsWith("new-")) {
        payload.sessionId = sessionId;
      }

      const res = await api.post("/api/chat/message", payload);
      const { reply, suggestions: nextSuggestions, eventCreated: created, eventId: createdId, sessionId: returnedSessionId } = res.data;

      setMessages((prev) => [...prev, msg("assistant", reply ?? "I couldn't process that message.")]);
      setSuggestions(nextSuggestions ?? []);
      if (created) {
        setEventCreated(true);
        setEventId(createdId ?? null);
      }
      if (returnedSessionId && returnedSessionId !== sessionId) {
        setSessionId(returnedSessionId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat request failed";
      toast.error(message);
      setMessages((prev) => [...prev, msg("assistant", "Something went wrong. Please try again.")]);
    } finally {
      setBusy(false);
    }
  };

  const onTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleChipClick = async (suggestion: string) => {
    await sendMessage(suggestion);
  };

  const handleImageFile = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid()}.${ext}`;
      const { error } = await supabase.storage.from("event-banners").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const { data: pub } = supabase.storage.from("event-banners").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      if (!publicUrl) throw new Error("Failed to retrieve uploaded banner URL");

      await sendMessage(`Banner image uploaded: ${publicUrl}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-2xl flex-col px-3 sm:px-6">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} role={message.role} content={message.content} />
          ))}

          {eventCreated ? (
            <div className="flex justify-start">
              <Card className="flex w-full max-w-[95%] items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Event created successfully.</p>
                  <Button variant="link" className="h-auto p-0" onClick={() => navigate({ to: "/dashboard" })}>
                    Go to dashboard
                  </Button>
                </div>
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

      <div className="flex items-center gap-2 py-2">
        <ImageUploader onFile={handleImageFile} disabled={busy} />
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 py-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void handleChipClick(suggestion)}
              disabled={busy}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={onTextSubmit} className="sticky bottom-0 mt-2 flex items-end gap-2 border-t border-border bg-background py-3">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          rows={1}
          className="max-h-32 min-h-10 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onTextSubmit(e);
            }
          }}
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({ role, content }: { role: Role; content: string }) {
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
          const file = e.target.files?.[0];
          if (file) onFile(file);
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
