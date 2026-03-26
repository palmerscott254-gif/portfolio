import { FILTERS } from "../constants.js";

export function renderFilterBar({ filterBar, activeFilter, onFilterChange }) {
  filterBar.innerHTML = "";
  FILTERS.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = filter;
    if (filter === activeFilter) {
      button.style.borderColor = "var(--brand)";
    }
    button.addEventListener("click", () => onFilterChange(filter));
    filterBar.appendChild(button);
  });
}

function imageForProject(project) {
  const base = "data:image/svg+xml;charset=UTF-8,";
  const colorA = "%231b2b5b";
  const colorB = "%235c2f78";
  const label = encodeURIComponent(project.name.slice(0, 18));
  return `${base}<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'><defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='${colorA}'/><stop offset='1' stop-color='${colorB}'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g)'/><circle cx='640' cy='90' r='160' fill='%23ffffff1f'/><text x='40' y='240' fill='%23ffffff' font-family='Inter,Arial' font-size='42'>${label}</text></svg>`;
}

export function renderProjectGrid({ projectGrid, projects, activeFilter, onOpenProject }) {
  const visible = activeFilter === "all"
    ? projects
    : projects.filter((project) => project.tags.includes(activeFilter));

  projectGrid.innerHTML = "";

  visible.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project-card panel js-tilt";
    card.innerHTML = `
      <img class="thumb" alt="${project.name} visual" loading="lazy" decoding="async" src="${imageForProject(project)}" />
      <h3>${project.name}</h3>
      <p>${project.desc}</p>
      <div class="subtle" style="margin-top:.4rem;">Impact: ${project.impact || "Impact details pending."}</div>
      <div class="tag-row">${project.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
      <button type="button" class="btn btn-ghost project-open" style="margin-top:.65rem;">Open Deep Dive</button>
    `;
    card.querySelector(".project-open")?.addEventListener("click", () => {
      if (typeof onOpenProject === "function") onOpenProject(project);
    });
    projectGrid.appendChild(card);
  });
}
