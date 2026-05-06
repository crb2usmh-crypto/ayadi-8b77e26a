import { createFileRoute } from "@tanstack/react-router";

const VALIDATION_KEY = "119831831c401b2aa40aceb7e729f15de5";

export const Route = createFileRoute("/api/public/validation-key")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(VALIDATION_KEY, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
