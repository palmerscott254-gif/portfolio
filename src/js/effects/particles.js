function lowPowerDevice() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 700;
  const memory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const cores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  return reduced || small || memory || cores;
}

export function initParticleCanvas() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const enabled = !lowPowerDevice();
  if (!enabled) {
    canvas.style.display = "none";
    return;
  }

  let width = 0;
  let height = 0;
  const pointer = { x: 0.5, y: 0.5 };
  const particleCount = Math.min(66, Math.floor((window.innerWidth * window.innerHeight) / 28000));
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0009,
    vy: (Math.random() - 0.5) * 0.0009,
    z: 0.3 + Math.random() * 0.9
  }));

  function resize() {
    width = canvas.width = window.innerWidth * devicePixelRatio;
    height = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  document.addEventListener("mousemove", (event) => {
    pointer.x = event.clientX / window.innerWidth;
    pointer.y = event.clientY / window.innerHeight;
  });

  window.addEventListener("resize", resize);
  resize();

  function draw() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      particle.x += particle.vx + (pointer.x - 0.5) * 0.00045 * particle.z;
      particle.y += particle.vy + (pointer.y - 0.5) * 0.00045 * particle.z;

      if (particle.x < -0.05) particle.x = 1.05;
      if (particle.x > 1.05) particle.x = -0.05;
      if (particle.y < -0.05) particle.y = 1.05;
      if (particle.y > 1.05) particle.y = -0.05;

      const x = particle.x * window.innerWidth;
      const y = particle.y * window.innerHeight;
      const radius = 0.9 + particle.z * 1.5;
      ctx.beginPath();
      ctx.fillStyle = "rgba(139, 236, 255, 0.55)";
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let i = 0; i < particles.length; i += 1) {
      for (let j = i + 1; j < particles.length; j += 1) {
        const a = particles[i];
        const b = particles[j];
        const dx = (a.x - b.x) * window.innerWidth;
        const dy = (a.y - b.y) * window.innerHeight;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          const alpha = (1 - dist / 110) * 0.12;
          ctx.strokeStyle = `rgba(143, 235, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x * window.innerWidth, a.y * window.innerHeight);
          ctx.lineTo(b.x * window.innerWidth, b.y * window.innerHeight);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}
