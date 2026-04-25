import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, getTaskImage, type MockTask } from "@/lib/mockData";
import { isRtl } from "@/lib/i18n/config";

export function TaskCard({ task, index = 0 }: { task: MockTask; index?: number }) {
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const title = rtl ? task.title : task.titleEn;
  const location = rtl ? task.location : task.locationEn;
  const deadline = rtl ? task.deadline : task.deadlineEn;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
    >
      <Link
        to="/tasks/$taskId"
        params={{ taskId: task.id }}
        className="group glass-card relative block overflow-hidden rounded-3xl transition-shadow hover:shadow-2xl"
      >
        {task.featured && (
          <span className="absolute top-3 end-3 z-10 rounded-full gradient-brand px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
            ⭐ {rtl ? "مميزة" : "Featured"}
          </span>
        )}
        <div className="relative h-40 overflow-hidden">
          <img
            src={getTaskImage(task.imageSeed, 600, 320)}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 text-base font-bold leading-snug">{title}</h3>
            <Badge variant="secondary" className="shrink-0 rounded-full bg-primary/10 text-primary">
              {t(`categories.${task.category}`)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {deadline}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {task.offersCount} {t("task.offers")}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarImage src={getAvatarUrl(task.publisher.avatarSeed)} />
                <AvatarFallback>{task.publisher.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{task.publisher.name}</span>
            </div>
            <div className="text-end">
              <p className="text-lg font-bold gradient-text leading-none">
                {task.budget}
                <span className="ms-1 text-xs font-medium text-muted-foreground">
                  {t("common.currency")}
                </span>
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}