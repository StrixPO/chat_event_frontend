import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";

type EventRow = {
  id: string;
  event_name?: string | null;
  subheading?: string | null;
  description?: string | null;
  banner_image_url?: string | null;
  timezone?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  vanish_date?: string | null;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch ((status ?? "").toLowerCase()) {
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return d;
  }
}

function DashboardPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<EventRow[]>("/api/events");
      setEvents(res.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/events/${id}`);
      toast.success("Event deleted");
      setEvents((e) => e.filter((x) => x.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete event");
    }
  };

  const handleEdit = async (eventId: string) => {
    navigate({ to: "/chat/$sessionId", params: { sessionId: `new-${eventId}` } });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Loading…" : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button asChild>
          <Link to="/">
            <Plus className="h-4 w-4" /> New event
          </Link>
        </Button>
      </div>

      {!loading && events.length === 0 ? (
        <Card className="mt-10 flex flex-col items-center gap-3 p-10 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No events yet. Start a chat to create one.</p>
          <Button asChild>
            <Link to="/">
              <Plus className="h-4 w-4" /> Create your first event
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <Card key={ev.id} className="flex flex-col overflow-hidden">
              {ev.banner_image_url ? (
                <img
                  src={ev.banner_image_url}
                  alt={ev.event_name ?? "Event banner"}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-32 w-full bg-muted" />
              )}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium">{ev.event_name ?? "Untitled event"}</h3>
                    {ev.subheading ? (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{ev.subheading}</p>
                    ) : null}
                  </div>
                  <Badge variant={statusVariant(ev.status)}>{ev.status ?? "Draft"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Starts {formatDate(ev.start_date)}</p>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(ev.id)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete your event. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(ev.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
