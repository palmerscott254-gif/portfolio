export function initTilt() {
  const supportsHover = window.matchMedia("(hover: hover)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!supportsHover || reduced) return;

  function attach(card) {
    let raf = null;
    function onMove(event) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const bounds = card.getBoundingClientRect();
        const px = (event.clientX - bounds.left) / bounds.width;
        const py = (event.clientY - bounds.top) / bounds.height;
        const rotateY = (px - 0.5) * 10;
        const rotateX = (0.5 - py) * 8;
        card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
      });
    }

    function onLeave() {
      if (raf) cancelAnimationFrame(raf);
      card.style.transform = "";
    }

    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseleave", onLeave);
  }

  document.querySelectorAll(".js-tilt").forEach(attach);
}
