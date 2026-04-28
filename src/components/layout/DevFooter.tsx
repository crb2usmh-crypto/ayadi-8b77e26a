import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePiAuth } from "@/components/providers/PiAuthProvider";

export function DevFooter() {
  const { loginAsDev } = usePiAuth();
  const navigate = useNavigate();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 3000);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      loginAsDev();
      toast.success("Developer Mode — تم تسجيل الدخول كمطور");
      navigate({ to: "/" });
    }
  };

  return (
    <footer className="relative z-10 flex justify-center pb-2 pt-1">
      <button
        type="button"
        onClick={handleTap}
        aria-label="dev"
        className="text-[9px] text-muted-foreground/20 hover:text-muted-foreground/40 transition-colors px-2 py-1 select-none"
      >
        Dev
      </button>
    </footer>
  );
}