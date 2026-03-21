export function initCursorGlow() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsHover = window.matchMedia("(hover: hover)").matches;
  const glow = document.getElementById("cursor-glow");

  if (reduced || !supportsHover || !glow) {
    if (glow) glow.style.display = "none";
    return;
  }

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  document.addEventListener("mousemove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
  });

  function tick() {
    currentX += (targetX - currentX) * 0.18;
    currentY += (targetY - currentY) * 0.18;
    glow.style.left = `${currentX}px`;
    glow.style.top = `${currentY}px`;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
