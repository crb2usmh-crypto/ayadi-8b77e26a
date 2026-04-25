import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockConversations, mockMessages, getAvatarUrl } from "@/lib/mockData";
import type { MockMessage } from "@/lib/mockData";
import { isRtl } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$conversationId")({
  loader: ({ params }) => {
    const conversation = mockConversations.find((c) => c.id === params.conversationId);
    if (!conversation) throw notFound();
    const messages = mockMessages[params.conversationId] ?? [];
    return { conversation, messages };
  },
  notFoundComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Link to="/messages" className="text-primary underline">
        العودة للرسائل
      </Link>
    </div>
  ),
  component: ChatRoom,
});

function ChatRoom() {
  const { conversation, messages } = Route.useLoaderData();
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<MockMessage[]>(messages);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLocalMessages((prev: MockMessage[]) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversationId: conversation.id,
        senderId: "me",
        text: input,
        textEn: input,
        createdAt: "الآن",
      },
    ]);
    setInput("");
  };

  return (
    <>
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b p-4">
        <Link to="/messages" className="md:hidden">
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <Avatar className="size-10">
          <AvatarImage src={getAvatarUrl(conversation.participant.avatarSeed)} />
          <AvatarFallback>{conversation.participant.name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{conversation.participant.name}</p>
          <p className="text-xs text-muted-foreground">⭐ {conversation.participant.rating}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {localMessages.map((m: MockMessage) => {
          const isMe = m.senderId === "me";
          const text = rtl ? m.text : m.textEn;
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
                <p className="leading-relaxed">{text}</p>
                <p className={cn("mt-1 text-[10px]", isMe ? "text-white/70" : "text-muted-foreground")}>
                  {m.createdAt}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("messages.typePlaceholder")}
          className="h-11 rounded-full border-border bg-background/40"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-full gradient-brand text-white shadow"
        >
          <Send className="size-4 rtl:rotate-180" />
        </Button>
      </form>
    </>
  );
}