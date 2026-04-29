import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./StarRating";
import { fireConfetti } from "@/lib/confetti";

interface ReviewFormProps {
  taskId: string;
  accessToken: string;
  revieweePiUid: string;
}

export function ReviewForm({ taskId, accessToken, revieweePiUid }: ReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/reviews-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          taskId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      fireConfetti();
      toast.success(t("review.thanks"));
      setComment("");
      setRating(0);
      queryClient.invalidateQueries({ queryKey: ["reviews", "byTask", taskId] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "byUser", revieweePiUid] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      toast.error(t("review.ratingRequired"));
      return;
    }
    submit.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">{t("review.rateOther")}</label>
        <StarRating value={rating} onChange={setRating} size={32} />
      </div>
      <div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("review.placeholder")}
          rows={3}
          maxLength={1000}
          className="rounded-xl"
        />
      </div>
      <Button
        type="submit"
        disabled={submit.isPending || rating < 1}
        className="w-full rounded-full gradient-brand text-white"
      >
        {submit.isPending ? (
          <>
            <Loader2 className="me-2 size-4 animate-spin" />
            {t("review.submitting")}
          </>
        ) : (
          t("review.submit")
        )}
      </Button>
    </form>
  );
}