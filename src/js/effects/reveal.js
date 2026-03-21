export function initReveal() {
  const nodes = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -10% 0px" });

  nodes.forEach((node) => observer.observe(node));
}
