import confetti from "canvas-confetti";

export function fireConfetti() {
  const defaults = { spread: 70, ticks: 80, gravity: 1, decay: 0.94, startVelocity: 30 };
  const colors = ["#6d28d9", "#a78bfa", "#ec4899", "#f472b6", "#c084fc"];

  confetti({
    ...defaults,
    particleCount: 60,
    origin: { y: 0.7, x: 0.3 },
    colors,
  });
  confetti({
    ...defaults,
    particleCount: 60,
    origin: { y: 0.7, x: 0.7 },
    colors,
  });
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 80,
      origin: { y: 0.6, x: 0.5 },
      colors,
      spread: 100,
    });
  }, 200);
}