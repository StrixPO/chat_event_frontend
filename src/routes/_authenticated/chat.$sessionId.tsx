import { createFileRoute } from "@tanstack/react-router";
import { EventChat } from "@/components/event-chat";

export const Route = createFileRoute("/_authenticated/chat/$sessionId")({
  component: ChatSession,
});

function ChatSession() {
  const { sessionId } = Route.useParams();
  return <EventChat sessionId={sessionId} />;
}
