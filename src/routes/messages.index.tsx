import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/messages/")({
  component: EmptyChat,
});

function EmptyChat() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
      <div className="flex size-20 items-center justify-center rounded-full gradient-brand text-white shadow-lg">
        <MessageCircle className="size-10" />
      </div>
      <p className="text-lg font-medium">{t("messages.selectChat")}</p>
    </div>
  );
}