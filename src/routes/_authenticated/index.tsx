import { createFileRoute } from "@tanstack/react-router";
import { EventChat } from "@/components/event-chat";

export const Route = createFileRoute("/_authenticated/")({
  component: () => <EventChat />,
});
