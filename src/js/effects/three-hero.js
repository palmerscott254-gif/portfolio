function shouldSkipThree() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tiny = window.innerWidth < 920;
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return reduced || tiny || lowMemory;
}

export async function initThreeHero(mountId) {
  const mount = document.getElementById(mountId);
  if (!mount || shouldSkipThree()) return;

  const [{ Scene, PerspectiveCamera, WebGLRenderer, TorusKnotGeometry, MeshStandardMaterial, Mesh, PointLight, AmbientLight, Color }, { OrbitControls }] = await Promise.all([
    import("/node_modules/three/build/three.module.js"),
    import("/node_modules/three/examples/jsm/controls/OrbitControls.js")
  ]);

  const scene = new Scene();
  scene.background = null;

  const camera = new PerspectiveCamera(42, mount.clientWidth / 220, 0.1, 100);
  camera.position.set(0, 0.1, 3.6);

  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(mount.clientWidth, 220);
  mount.appendChild(renderer.domElement);

  const object = new Mesh(
    new TorusKnotGeometry(0.74, 0.23, 120, 18),
    new MeshStandardMaterial({ color: new Color("#7ef7ff"), metalness: 0.55, roughness: 0.2 })
  );
  scene.add(object);

  const ambient = new AmbientLight(0xa3b8ff, 0.8);
  const key = new PointLight(0xb59bff, 1.2, 16);
  key.position.set(2.5, 2, 3.2);
  scene.add(ambient, key);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.1;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      renderer.domElement.style.opacity = entry.isIntersecting ? "1" : "0";
    });
  });
  observer.observe(mount);

  function onResize() {
    const width = mount.clientWidth;
    camera.aspect = width / 220;
    camera.updateProjectionMatrix();
    renderer.setSize(width, 220);
  }

  window.addEventListener("resize", onResize);

  function animate() {
    object.rotation.x += 0.0025;
    object.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
