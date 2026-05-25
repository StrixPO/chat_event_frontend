import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const FIELD_LABELS: Record<string, string> = {
  event_name: "Event Name",
  subheading: "Subheading (optional)",
  description: "Description",
  banner_image_url: "Banner Image",
  timezone: "Time Zone",
  status: "Status",
  start_date: "Start Date",
  end_date: "End Date",
  vanish_date: "Vanish Date",
  roles: "Roles",
};

const InputSchema = z.object({
  mode: z.enum(["ask_field", "acknowledge_and_ask", "ask_edit_target", "confirm_summary", "edit_complete"]),
  currentField: z.string().optional(),
  previousField: z.string().optional(),
  userInput: z.string().optional(),
  collected: z.record(z.unknown()).optional(),
});

const ResponseSchema = z.object({
  message: z.string().describe("The assistant's next message — conversational, friendly, brief (1-3 sentences)."),
  suggestions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2-4 short quick-reply chip labels (each under 30 chars) the user might tap."),
});

export const eventChatStep = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are a warm, concise assistant helping a user create an event through chat. Speak naturally, like a helpful colleague. Keep replies short (1-3 sentences). Never use markdown headings. Do not list multiple questions at once — ask for ONE thing at a time. Use the user's prior answers to make the conversation feel personal.

When suggesting quick-reply chips: make them short, specific, and immediately useful (e.g. example values, "Skip", "Use a placeholder", "Yes", "No"). Never include the literal field name as a chip.`;

    const collectedJson = JSON.stringify(data.collected ?? {}, null, 2);
    let prompt = `Collected so far:\n${collectedJson}\n\n`;

    if (data.mode === "ask_field" && data.currentField) {
      prompt += `Ask the user for the next field: "${FIELD_LABELS[data.currentField]}". This is the first question for this field. Make it feel natural given what's already collected.`;
    } else if (data.mode === "acknowledge_and_ask" && data.currentField) {
      prompt += `The user just answered "${FIELD_LABELS[data.previousField ?? ""] ?? data.previousField}" with: "${data.userInput ?? ""}". Briefly acknowledge it (one short clause), then ask for "${FIELD_LABELS[data.currentField]}".`;
    } else if (data.mode === "ask_edit_target") {
      prompt += `The user wants to edit something in their event. Ask which field they want to change. Suggestion chips should be the field names that were already collected.`;
    } else if (data.mode === "confirm_summary") {
      prompt += `All fields are now collected. Say something like "Here's what I've got — shall I create this event?" Suggestion chips should be "Yes, create it" and "Edit something".`;
    } else if (data.mode === "edit_complete" && data.previousField) {
      prompt += `The user just updated "${FIELD_LABELS[data.previousField]}". Briefly confirm the change and ask if they want to review the full summary again.`;
    }

    try {
      const { experimental_output } = await generateText({
        model,
        system,
        prompt,
        experimental_output: Output.object({ schema: ResponseSchema }),
      });
      return experimental_output;
    } catch (err) {
      console.error("event-chat AI error", err);
      // Deterministic fallback so the flow never stalls
      const fallback = data.currentField
        ? `What would you like for the ${FIELD_LABELS[data.currentField]?.toLowerCase() ?? "next field"}?`
        : "Let's keep going.";
      return { message: fallback, suggestions: ["Skip", "Tell me more"] };
    }
  });
