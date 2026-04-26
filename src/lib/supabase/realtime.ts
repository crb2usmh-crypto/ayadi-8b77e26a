import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { MessageRow } from "./types";

/**
 * Subscribe to INSERT events on `public.messages` for a given conversation
 * and patch the TanStack Query cache so new messages appear instantly.
 *
 * The corresponding migration has:
 *   ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
 */
export function useRealtimeMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const next = payload.new as MessageRow;
          queryClient.setQueryData<MessageRow[]>(
            ["messages", conversationId],
            (old) => {
              const prev = old ?? [];
              // Skip if we already inserted this row optimistically.
              if (prev.some((m) => m.id === next.id)) return prev;
              return [...prev, next];
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}