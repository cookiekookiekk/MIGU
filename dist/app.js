(function () {
  "use strict";

  const TOTAL_PAGES = 22;
  const MOBILE_QUERY = window.matchMedia("(max-width: 779px)");
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
  const book = document.getElementById("book");
  const loadingCard = document.getElementById("loadingCard");
  const pageLabel = document.getElementById("pageLabel");
  const pageSlider = document.getElementById("pageSlider");
  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");
  const previousPageZone = document.getElementById("previousPageZone");
  const nextPageZone = document.getElementById("nextPageZone");
  const thumbnailPanel = document.getElementById("thumbnailPanel");
  const thumbnailGrid = document.getElementById("thumbnailGrid");
  const thumbButton = document.getElementById("thumbButton");
  const closeThumbButton = document.getElementById("closeThumbButton");
  const fullscreenButton = document.getElementById("fullscreenButton");
  const scrim = document.getElementById("scrim");

  let currentPage = 1;
  let isAnimating = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let didSwipe = false;
  const preloadCache = new Map();

  const pageSrc = (page) => `pages/page-${String(page).padStart(2, "0")}.jpg`;
  const physicalRange = (page) => {
    if (page === 1) return "封面";
    if (page === TOTAL_PAGES) return "封底";
    const start = (page - 1) * 2;
    return `第 ${start}–${start + 1} 页`;
  };
  const pageName = (page) => physicalRange(page);

  function preload(page) {
    if (page < 1 || page > TOTAL_PAGES) return Promise.resolve();
    if (preloadCache.has(page)) return preloadCache.get(page);
    const image = new Image();
    const ready = new Promise((resolve) => {
      image.addEventListener("load", async () => {
        if (typeof image.decode === "function") {
          try { await image.decode(); } catch (_) { /* The loaded image is still usable. */ }
        }
        resolve();
      }, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
    image.src = pageSrc(page);
    preloadCache.set(page, ready);
    return ready;
  }

  function spreadFor(page) {
    if (page === 1) return [null, 1];
    if (page === TOTAL_PAGES) return [TOTAL_PAGES, null];
    return [page, page];
  }

  function normalizedPage(page) {
    const safe = Math.min(TOTAL_PAGES, Math.max(1, Number(page) || 1));
    return safe;
  }

  function makeImage(page, className = "page-image") {
    const image = document.createElement("img");
    image.className = className;
    image.src = pageSrc(page);
    image.width = 1362;
    image.height = 2000;
    image.alt = `${pageName(page)}页面图像`;
    image.draggable = false;
    return image;
  }

  function makeSlot(page, side, split = page > 1) {
    const slot = document.createElement("div");
    slot.className = `page-slot page-slot--${side}${page ? "" : " page-slot--empty"}`;
    if (page) {
      const image = makeImage(page);
      if (split) {
        image.classList.add("page-image--spread", `page-image--${side}`);
        image.alt = side === "left" ? (page === TOTAL_PAGES ? "封底图像" : `${physicalRange(page)}跨页图像`) : "";
      }
      slot.appendChild(image);
    }
    return slot;
  }

  function makeSpread(page) {
    const spread = document.createElement("div");
    spread.className = "spread-page";
    const image = makeImage(page);
    image.width = 2000;
    image.height = 1469;
    image.alt = `${physicalRange(page)}跨页图像`;
    spread.appendChild(image);
    return spread;
  }

  function render(page, announce = true) {
    currentPage = normalizedPage(page);
    const spread = spreadFor(currentPage);
    book.replaceChildren();
    const isCover = currentPage === 1 || currentPage === TOTAL_PAGES;
    book.classList.toggle("is-single", isCover);
    book.classList.toggle("is-back-cover", currentPage === TOTAL_PAGES);
    if (currentPage === 1) {
      const cover = makeSlot(1, "cover", false);
      cover.classList.add("page-slot--cover");
      book.appendChild(cover);
    } else if (currentPage === TOTAL_PAGES) {
      const backCover = makeSlot(TOTAL_PAGES, "left", true);
      backCover.classList.add("page-slot--cover");
      book.appendChild(backCover);
    } else {
      book.appendChild(makeSpread(currentPage));
    }

    updateControls(spread, announce);
    for (let i = currentPage - 2; i <= currentPage + 4; i += 1) preload(i);
  }

  function updateControls(spread, announce) {
    const label = physicalRange(currentPage);
    pageLabel.textContent = label;
    pageSlider.value = String(currentPage);
    previousButton.disabled = currentPage <= 1;
    previousPageZone.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= TOTAL_PAGES;
    nextPageZone.disabled = currentPage >= TOTAL_PAGES;
    document.querySelectorAll(".thumbnail-button").forEach((button) => {
      button.setAttribute("aria-current", Number(button.dataset.page) === currentPage ? "page" : "false");
    });
    book.setAttribute("aria-label", `当前显示：${label}`);
    window.location.hash = `page=${currentPage}`;
  }

  function destination(direction) {
    return currentPage + direction;
  }

  async function turn(direction) {
    const target = destination(direction);
    if (target < 1 || target > TOTAL_PAGES || isAnimating) return;
    isAnimating = true;
    await preload(target);
    if (REDUCED_MOTION.matches) {
      render(target);
      isAnimating = false;
      return;
    }

    if (currentPage === 1 || target === 1 || currentPage === TOTAL_PAGES || target === TOTAL_PAGES) {
      const frames = direction > 0
        ? [{ opacity: 1, transform: "perspective(1800px) rotateY(0deg)" }, { opacity: .35, transform: "perspective(1800px) rotateY(-72deg)" }, { opacity: 0, transform: "perspective(1800px) rotateY(-102deg)" }]
        : [{ opacity: 0, transform: "perspective(1800px) rotateY(-102deg)" }, { opacity: .35, transform: "perspective(1800px) rotateY(-72deg)" }, { opacity: 1, transform: "perspective(1800px) rotateY(0deg)" }];
      book.animate(frames, { duration: 620, easing: "cubic-bezier(.24,.72,.18,1)" });
      window.setTimeout(() => render(target), 310);
      window.setTimeout(() => { isAnimating = false; }, 650);
      return;
    }

    const currentSpread = spreadFor(currentPage);
    const targetSpread = spreadFor(target);
    const currentLeft = currentSpread[0];
    const currentRight = currentSpread[1];
    const targetLeft = targetSpread[0];
    const targetRight = targetSpread[1];
    const turningFront = direction > 0 ? currentRight : currentLeft;
    const turningBack = direction > 0 ? targetLeft : targetRight;

    if (!turningFront || !turningBack) {
      book.animate(
        [{ opacity: 1, transform: "translateX(0) rotateY(0)" }, { opacity: .25, transform: `translateX(${-direction * 16}px) rotateY(${direction * -4}deg)` }, { opacity: 1, transform: "translateX(0) rotateY(0)" }],
        { duration: 460, easing: "cubic-bezier(.2,.7,.2,1)" }
      );
      window.setTimeout(() => render(target), 210);
      window.setTimeout(() => { isAnimating = false; }, 480);
      return;
    }

    book.classList.remove("is-single");
    book.replaceChildren(makeSpread(target));

    const guard = makeSlot(direction > 0 ? currentLeft : currentRight, direction > 0 ? "left" : "right");
    guard.classList.add("page-guard", direction > 0 ? "left" : "right");
    const sheet = document.createElement("div");
    sheet.className = `turn-sheet ${direction > 0 ? "forward" : "backward"}`;
    const front = document.createElement("div");
    front.className = "turn-face front";
    front.appendChild(makeSlot(turningFront, direction > 0 ? "right" : "left").firstChild);
    const back = document.createElement("div");
    back.className = "turn-face back";
    back.appendChild(makeSlot(turningBack, direction > 0 ? "left" : "right").firstChild);
    sheet.append(front, back);
    book.append(guard, sheet);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      sheet.classList.add("go");
      guard.classList.add("fade");
    }));

    window.setTimeout(() => guard.remove(), 410);

    window.setTimeout(() => {
      isAnimating = false;
      render(target);
    }, 750);
  }

  function buildThumbnails() {
    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= TOTAL_PAGES; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumbnail-button";
      button.dataset.page = String(page);
      button.setAttribute("aria-label", `打开${pageName(page)}`);
      const image = makeImage(page);
      image.loading = page > 6 ? "lazy" : "eager";
      image.alt = "";
      const number = document.createElement("span");
      number.textContent = page === 1 ? "封面" : page === TOTAL_PAGES ? "封底" : `${(page - 1) * 2}–${(page - 1) * 2 + 1}`;
      button.append(image, number);
      button.addEventListener("click", () => {
        render(page);
        closeThumbnails();
      });
      fragment.appendChild(button);
    }
    thumbnailGrid.appendChild(fragment);
  }

  function openThumbnails() {
    thumbnailPanel.inert = false;
    thumbnailPanel.classList.add("is-open");
    thumbnailPanel.setAttribute("aria-hidden", "false");
    thumbButton.setAttribute("aria-expanded", "true");
    scrim.hidden = false;
    closeThumbButton.focus();
  }

  function closeThumbnails() {
    thumbnailPanel.classList.remove("is-open");
    thumbnailPanel.setAttribute("aria-hidden", "true");
    thumbnailPanel.inert = true;
    thumbButton.setAttribute("aria-expanded", "false");
    scrim.hidden = true;
    thumbButton.focus();
  }

  function updateFullscreenState() {
    const active = Boolean(document.fullscreenElement);
    document.body.classList.toggle("is-fullscreen", active);
    fullscreenButton.setAttribute("aria-label", active ? "退出全屏阅读" : "进入全屏阅读");
  }

  [previousButton, previousPageZone].forEach((button) => button.addEventListener("click", () => turn(-1)));
  [nextButton, nextPageZone].forEach((button) => button.addEventListener("click", () => turn(1)));
  thumbButton.addEventListener("click", openThumbnails);
  closeThumbButton.addEventListener("click", closeThumbnails);
  scrim.addEventListener("click", closeThumbnails);
  pageSlider.addEventListener("input", (event) => render(event.target.value, false));
  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  });
  document.addEventListener("fullscreenchange", updateFullscreenState);

  document.addEventListener("keydown", (event) => {
    if (!thumbnailPanel.classList.contains("is-open") && event.key === "ArrowRight") turn(1);
    if (!thumbnailPanel.classList.contains("is-open") && event.key === "ArrowLeft") turn(-1);
    if (event.key === "Escape" && thumbnailPanel.classList.contains("is-open")) closeThumbnails();
  });

  book.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
    didSwipe = false;
  }, { passive: true });
  book.addEventListener("touchend", (event) => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) > 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      didSwipe = true;
      turn(deltaX < 0 ? 1 : -1);
    }
  }, { passive: true });

  book.addEventListener("click", (event) => {
    if (didSwipe) {
      didSwipe = false;
      return;
    }
    if (currentPage === 1) {
      turn(1);
      return;
    }
    if (currentPage === TOTAL_PAGES) {
      turn(-1);
      return;
    }
    const bounds = book.getBoundingClientRect();
    turn(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
  });

  MOBILE_QUERY.addEventListener("change", () => render(currentPage, false));
  buildThumbnails();
  const requestedPage = Number(window.location.hash.replace("#page=", ""));
  preload(1).then(() => {
    loadingCard.classList.add("is-hidden");
    window.setTimeout(() => { loadingCard.hidden = true; }, 260);
    render(requestedPage >= 1 && requestedPage <= TOTAL_PAGES ? requestedPage : 1);
    const warmPages = [2, 3, TOTAL_PAGES];
    warmPages.forEach(preload);
    const warmAll = () => {
      for (let page = 1; page <= TOTAL_PAGES; page += 1) preload(page);
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(warmAll, { timeout: 1800 });
    else window.setTimeout(warmAll, 500);
  });
})();
