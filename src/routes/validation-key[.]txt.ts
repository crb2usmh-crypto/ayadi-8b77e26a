import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/validation-key.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("119831831c401b2aa40aceb7e729f15de5", {
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
