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

  const pageSrc = (page) => `pages/page-${String(page).padStart(2, "0")}.jpg`;
  const pageName = (page) => page === 1 ? "封面" : page === TOTAL_PAGES ? "封底" : `第 ${page} 页`;

  function preload(page) {
    if (page < 1 || page > TOTAL_PAGES) return;
    const image = new Image();
    image.src = pageSrc(page);
  }

  function spreadFor(page) {
    if (MOBILE_QUERY.matches) return [page];
    if (page === 1) return [null, 1];
    if (page === TOTAL_PAGES) return [TOTAL_PAGES, null];
    return page % 2 === 0 ? [page, page + 1] : [page - 1, page];
  }

  function normalizedPage(page) {
    const safe = Math.min(TOTAL_PAGES, Math.max(1, Number(page) || 1));
    if (MOBILE_QUERY.matches || safe === 1 || safe === TOTAL_PAGES) return safe;
    return safe % 2 === 0 ? safe : safe - 1;
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

  function makeSlot(page, side) {
    const slot = document.createElement("div");
    slot.className = `page-slot page-slot--${side}${page ? "" : " page-slot--empty"}`;
    if (page) slot.appendChild(makeImage(page));
    return slot;
  }

  function render(page, announce = true) {
    currentPage = normalizedPage(page);
    const spread = spreadFor(currentPage);
    book.replaceChildren();
    book.classList.toggle("is-single", spread.length === 1 || spread.includes(null));

    if (spread.length === 1) {
      book.appendChild(makeSlot(spread[0], "right"));
    } else if (spread.includes(null)) {
      const onlyPage = spread.find(Boolean);
      book.appendChild(makeSlot(onlyPage, onlyPage === 1 ? "right" : "left"));
    } else {
      book.append(makeSlot(spread[0], "left"), makeSlot(spread[1], "right"));
    }

    updateControls(spread, announce);
    for (let i = currentPage - 2; i <= currentPage + 4; i += 1) preload(i);
  }

  function updateControls(spread, announce) {
    const visible = spread.filter(Boolean);
    const label = visible.length > 1 ? `第 ${visible[0]}–${visible[1]} 页 / ${TOTAL_PAGES}` : `${pageName(visible[0])} / ${TOTAL_PAGES}`;
    pageLabel.textContent = label;
    pageSlider.value = String(currentPage);
    previousButton.disabled = currentPage <= 1;
    previousPageZone.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= TOTAL_PAGES;
    nextPageZone.disabled = currentPage >= TOTAL_PAGES;
    document.querySelectorAll(".thumbnail-button").forEach((button) => {
      button.setAttribute("aria-current", visible.includes(Number(button.dataset.page)) ? "page" : "false");
    });
    if (announce) book.setAttribute("aria-label", `当前显示：${label}`);
    window.location.hash = `page=${currentPage}`;
  }

  function destination(direction) {
    if (MOBILE_QUERY.matches) return currentPage + direction;
    if (direction > 0) {
      if (currentPage === 1) return 2;
      if (currentPage >= 20) return 22;
      return currentPage + 2;
    }
    if (currentPage === 22) return 20;
    if (currentPage <= 2) return 1;
    return currentPage - 2;
  }

  function turn(direction) {
    const target = destination(direction);
    if (target < 1 || target > TOTAL_PAGES || isAnimating) return;
    if (MOBILE_QUERY.matches || REDUCED_MOTION.matches) {
      render(target);
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
      return;
    }

    isAnimating = true;
    book.classList.remove("is-single");
    book.replaceChildren(makeSlot(targetLeft, "left"), makeSlot(targetRight, "right"));

    const guard = makeSlot(direction > 0 ? currentLeft : currentRight, direction > 0 ? "left" : "right");
    guard.classList.add("page-guard", direction > 0 ? "left" : "right");
    const sheet = document.createElement("div");
    sheet.className = `turn-sheet ${direction > 0 ? "forward" : "backward"}`;
    const front = document.createElement("div");
    front.className = "turn-face front";
    front.appendChild(makeImage(turningFront));
    const back = document.createElement("div");
    back.className = "turn-face back";
    back.appendChild(makeImage(turningBack));
    sheet.append(front, back);
    book.append(guard, sheet);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      sheet.classList.add("go");
      guard.classList.add("fade");
    }));

    window.setTimeout(() => {
      isAnimating = false;
      render(target);
    }, 760);
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
      number.textContent = String(page).padStart(2, "0");
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
  }, { passive: true });
  book.addEventListener("touchend", (event) => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) > 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) turn(deltaX < 0 ? 1 : -1);
  }, { passive: true });

  MOBILE_QUERY.addEventListener("change", () => render(currentPage, false));
  buildThumbnails();
  const requestedPage = Number(window.location.hash.replace("#page=", ""));
  const cover = new Image();
  cover.addEventListener("load", () => {
    loadingCard.classList.add("is-hidden");
    window.setTimeout(() => { loadingCard.hidden = true; }, 260);
    render(requestedPage >= 1 && requestedPage <= TOTAL_PAGES ? requestedPage : 1);
  });
  cover.addEventListener("error", () => { loadingCard.textContent = "页面加载失败，请确认 pages 文件夹完整。"; });
  cover.src = pageSrc(1);
})();
