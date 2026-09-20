// Recent questions from Atlas (empty list if Atlas is not set up).
import { recentQuestions } from "@/lib/atlas";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ questions: await recentQuestions(5) });
}
