import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conversationBundleQueryOptions } from "@/lib/supabase/queries";
import { getAvatarUrl } from "@/lib/supabase/types";
import type { MessageRow } from "@/lib/supabase/types";
import { useRealtimeMessages } from "@/lib/supabase/realtime";
import { usePiAuth } from "@/components/providers/PiAuthProvider";
import { isRtl } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$conversationId")({
  component: ChatRoom,
});

function ChatRoom() {
  const { conversationId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const { session } = usePiAuth();
  const accessToken = session?.accessToken;
  const myUid = session?.user.uid;
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery(
    conversationBundleQueryOptions(conversationId, accessToken),
  );

  // Subscribe to realtime INSERTs for this conversation. The hook patches
  // the cache under the ["messages", conversationId] key, so we mirror the
  // bundle's messages array into that key whenever it changes.
  useEffect(() => {
    if (!data) return;
    queryClient.setQueryData<MessageRow[]>(
      ["messages", conversationId],
      data.messages,
    );
  }, [data, conversationId, queryClient]);
  useRealtimeMessages(accessToken ? conversationId : null);

  // Pull messages live from the realtime cache key.
  const liveMessages =
    queryClient.getQueryData<MessageRow[]>(["messages", conversationId]) ??
    data?.messages ??
    [];

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveMessages.length]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!accessToken) throw new Error(t("messages.loginRequired"));
      const res = await fetch("/api/public/messages-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, conversationId, body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (json) => {
      const next = json?.message as MessageRow | null;
      if (next) {
        queryClient.setQueryData<MessageRow[]>(
          ["messages", conversationId],
          (old) => {
            const prev = old ?? [];
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          },
        );
      }
      // Refresh sidebar ordering.
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage.mutate(text);
  };

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
        <Lock className="size-10 opacity-50" />
        <p>{t("messages.loginRequired")}</p>
        <Link
          to="/auth"
          className="rounded-full gradient-brand px-4 py-2 text-xs font-medium text-white"
        >
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="me-2 size-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  if (error || !data?.conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <Lock className="size-10 opacity-50" />
        <p>{t("messages.unauthorized")}</p>
        <Link to="/messages" className="text-primary underline text-sm">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  const conv = data.conversation;
  const isOwnerSide = conv.owner_pi_uid === myUid;
  const other = isOwnerSide ? conv.bidder : conv.owner;
  const otherName = other?.display_name || other?.username || "—";
  const taskTitle = rtl
    ? conv.task?.title ?? ""
    : conv.task?.title_en ?? conv.task?.title ?? "";

  return (
    <>
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b p-4">
        <Link to="/messages" className="md:hidden">
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <Avatar className="size-10">
          <AvatarImage
            src={getAvatarUrl(other?.avatar_seed || other?.username)}
          />
          <AvatarFallback>{otherName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold">{otherName}</p>
          {conv.task && (
            <Link
              to="/tasks/$taskId"
              params={{ taskId: conv.task.id }}
              className="truncate text-xs text-primary hover:underline"
            >
              {taskTitle}
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {liveMessages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("messages.empty")}
          </p>
        )}
        {liveMessages.map((m) => {
          const isMe = m.sender_pi_uid === myUid;
          const time = new Date(m.created_at).toLocaleTimeString(
            rtl ? "ar" : "en",
            { hour: "2-digit", minute: "2-digit" },
          );
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", isMe ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                  isMe
                    ? "gradient-brand text-white rounded-ee-sm"
                    : "glass-card rounded-es-sm",
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed break-words">
                  {m.body}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    isMe ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {time}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("messages.typePlaceholder")}
          maxLength={4000}
          className="h-11 rounded-full border-border bg-background/40"
          disabled={sendMessage.isPending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sendMessage.isPending || !input.trim()}
          className="size-11 shrink-0 rounded-full gradient-brand text-white shadow"
        >
          {sendMessage.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4 rtl:rotate-180" />
          )}
        </Button>
      </form>
    </>
  );
}