import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "./StarRating";
import { getAvatarUrl } from "@/lib/supabase/types";
import type { ReviewWithReviewer } from "@/lib/supabase/types";
import { isRtl } from "@/lib/i18n/config";

interface ReviewsListProps {
  reviews: ReviewWithReviewer[];
}

export function ReviewsList({ reviews }: ReviewsListProps) {
  const { t, i18n } = useTranslation();
  const rtl = isRtl(i18n.language);

  if (reviews.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("review.noReviews")}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r) => {
        const name = r.reviewer?.display_name || r.reviewer?.username || "—";
        const seed = r.reviewer?.avatar_seed || r.reviewer?.username || "anon";
        return (
          <li
            key={r.id}
            className="rounded-2xl border border-border/50 bg-background/60 p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar className="size-10 ring-2 ring-primary/10">
                <AvatarImage src={getAvatarUrl(seed, 64)} />
                <AvatarFallback>{name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString(rtl ? "ar" : "en")}
                  </span>
                </div>
                <StarRating value={r.rating} readonly size={14} className="mt-1" />
                {r.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}