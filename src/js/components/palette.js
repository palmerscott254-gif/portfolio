export function initCommandPalette({ onRunAdvisor }) {
  const palette = document.getElementById("palette");
  const commandToggle = document.getElementById("commandToggle");
  const commandInput = document.getElementById("commandInput");

  function openPalette() {
    palette.showModal();
    setTimeout(() => commandInput.focus(), 20);
  }

  function goTo(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  commandToggle.addEventListener("click", openPalette);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette();
    }
  });

  document.querySelectorAll(".palette-item").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.cmd;
      palette.close();
      if (command === "projects") goTo("projects");
      if (command === "advisor") {
        goTo("advisor");
        onRunAdvisor();
      }
      if (command === "horizon") goTo("horizon");
      if (command === "assistant") goTo("assistant");
      if (command === "contact") goTo("contact");
    });
  });

  commandInput.addEventListener("input", () => {
    const query = commandInput.value.toLowerCase();
    document.querySelectorAll(".palette-item").forEach((button) => {
      button.style.display = button.textContent.toLowerCase().includes(query) ? "block" : "none";
    });
  });

  return { openPalette };
}
