(function () {
  "use strict";

  const TOTAL_LOGICAL_PAGES = 22;
  const BACK_COVER_SOURCE = 22;
  const TOTAL_PHYSICAL_PAGES = 42;
  const LAST_PHYSICAL_PAGE = TOTAL_PHYSICAL_PAGES - 1;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
  const book = document.getElementById("book");
  const loadingCard = document.getElementById("loadingCard");
  const thumbnailPanel = document.getElementById("thumbnailPanel");
  const thumbnailGrid = document.getElementById("thumbnailGrid");
  const thumbButton = document.getElementById("thumbButton");
  const closeThumbButton = document.getElementById("closeThumbButton");
  const scrim = document.getElementById("scrim");

  let pageFlip = null;
  let currentPhysicalPage = 0;

  const sourceFor = (page) => `pages/page-${String(page).padStart(2, "0")}.jpg`;
  const logicalLabel = (page) => {
    if (page === 1) return "封面";
    if (page === TOTAL_LOGICAL_PAGES) return "封底";
    const start = (page - 1) * 2;
    return `第 ${start}–${start + 1} 页`;
  };

  function logicalToPhysical(page) {
    if (page <= 1) return 0;
    if (page >= TOTAL_LOGICAL_PAGES) return LAST_PHYSICAL_PAGE;
    return 1 + (page - 2) * 2;
  }

  function physicalToLogical(page) {
    if (page <= 0) return 1;
    if (page >= LAST_PHYSICAL_PAGE) return TOTAL_LOGICAL_PAGES;
    return Math.floor((page - 1) / 2) + 2;
  }

  function makeImage(source, side) {
    const image = document.createElement("img");
    image.className = "page-art";
    image.src = sourceFor(source);
    image.alt = "";
    image.draggable = false;
    if (side === "full") {
      image.width = 1362;
      image.height = 2000;
    } else {
      image.width = 2000;
      image.height = 1469;
      image.classList.add("page-art--spread", `page-art--${side}`);
    }
    return image;
  }

  function makePhysicalPage(source, side, label) {
    const page = document.createElement("div");
    page.className = "book-page";
    page.dataset.density = "soft";
    page.dataset.label = label;
    page.dataset.source = String(source);
    page.dataset.side = side;
    page.setAttribute("aria-hidden", "true");
    page.appendChild(makeImage(source, side));
    return page;
  }

  function buildPhysicalPages() {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(makePhysicalPage(1, "full", "封面"));
    for (let source = 2; source < BACK_COVER_SOURCE; source += 1) {
      const label = logicalLabel(source);
      fragment.appendChild(makePhysicalPage(source, "left", `${label}左页`));
      fragment.appendChild(makePhysicalPage(source, "right", `${label}右页`));
    }
    fragment.appendChild(makePhysicalPage(BACK_COVER_SOURCE, "left", "封底"));
    book.appendChild(fragment);
  }

  function preloadAllSources() {
    const tasks = [];
    for (let source = 1; source <= TOTAL_LOGICAL_PAGES; source += 1) {
      tasks.push(new Promise((resolve) => {
        const image = new Image();
        image.addEventListener("load", async () => {
          if (typeof image.decode === "function") {
            try { await image.decode(); } catch (_) { /* Loaded data remains usable. */ }
          }
          resolve();
        }, { once: true });
        image.addEventListener("error", resolve, { once: true });
        image.src = sourceFor(source);
      }));
    }
    return Promise.all(tasks);
  }

  function updateCurrentPage(physicalPage, updateHash = true) {
    currentPhysicalPage = physicalPage;
    const logicalPage = physicalToLogical(physicalPage);
    const label = logicalLabel(logicalPage);
    book.setAttribute("aria-label", `当前显示：${label}`);
    document.querySelectorAll(".thumbnail-button").forEach((button) => {
      button.setAttribute("aria-current", Number(button.dataset.page) === logicalPage ? "page" : "false");
    });
    if (updateHash && window.location.hash !== `#page=${logicalPage}`) window.location.hash = `page=${logicalPage}`;
  }

  function buildThumbnails() {
    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= TOTAL_LOGICAL_PAGES; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumbnail-button";
      button.dataset.page = String(page);
      button.setAttribute("aria-label", `打开${logicalLabel(page)}`);
      const image = document.createElement("img");
      image.src = sourceFor(page);
      image.alt = "";
      image.loading = page > 6 ? "lazy" : "eager";
      const number = document.createElement("span");
      number.textContent = page === 1 ? "封面" : page === TOTAL_LOGICAL_PAGES ? "封底" : `${(page - 1) * 2}–${(page - 1) * 2 + 1}`;
      button.append(image, number);
      button.addEventListener("click", () => {
        const target = logicalToPhysical(page);
        pageFlip.turnToPage(target);
        updateCurrentPage(target);
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
    thumbButton.setAttribute("aria-label", "关闭目录");
    scrim.hidden = false;
    closeThumbButton.focus();
  }

  function closeThumbnails() {
    thumbnailPanel.classList.remove("is-open");
    thumbnailPanel.setAttribute("aria-hidden", "true");
    thumbnailPanel.inert = true;
    thumbButton.setAttribute("aria-expanded", "false");
    thumbButton.setAttribute("aria-label", "打开目录");
    scrim.hidden = true;
    thumbButton.focus();
  }

  function jumpAcrossBinding(page) {
    if (!pageFlip) return;
    pageFlip.turnToPage(page);
    updateCurrentPage(page);
  }

  function bindInteractions() {
    thumbButton.addEventListener("click", openThumbnails);
    closeThumbButton.addEventListener("click", closeThumbnails);
    scrim.addEventListener("click", closeThumbnails);

    document.addEventListener("keydown", (event) => {
      if (thumbnailPanel.classList.contains("is-open")) {
        if (event.key === "Escape") closeThumbnails();
        return;
      }
      if (event.key === "ArrowRight") {
        currentPhysicalPage >= LAST_PHYSICAL_PAGE ? jumpAcrossBinding(0) : pageFlip.flipNext("top");
      }
      if (event.key === "ArrowLeft") {
        currentPhysicalPage <= 0 ? jumpAcrossBinding(LAST_PHYSICAL_PAGE) : pageFlip.flipPrev("top");
      }
    });

    book.addEventListener("click", (event) => {
      const bounds = book.getBoundingClientRect();
      const onLeft = event.clientX < bounds.left + bounds.width / 2;
      if (currentPhysicalPage === 0 && onLeft) jumpAcrossBinding(LAST_PHYSICAL_PAGE);
      if (currentPhysicalPage === LAST_PHYSICAL_PAGE && !onLeft) jumpAcrossBinding(0);
    });

    window.addEventListener("hashchange", () => {
      if (!pageFlip) return;
      const requested = Number(window.location.hash.replace("#page=", ""));
      if (requested >= 1 && requested <= TOTAL_LOGICAL_PAGES) {
        const target = logicalToPhysical(requested);
        if (physicalToLogical(currentPhysicalPage) !== requested) {
          pageFlip.turnToPage(target);
          updateCurrentPage(target, false);
        }
      }
    });

  }

  function installNaturalTurnPath(instance) {
    const controller = instance.getFlipController();
    const originalStart = controller.start.bind(controller);
    const originalDo = controller.do.bind(controller);
    const originalAnimate = controller.animateFlippingTo.bind(controller);

    controller.start = function (point) {
      let startPoint = point;
      if (currentPhysicalPage === LAST_PHYSICAL_PAGE - 2) {
        const bookPoint = this.render.convertToBook(point);
        if (this.getDirectionByPoint(bookPoint) === 0) {
          const rect = this.render.getRect();
          startPoint = { x: point.x, y: rect.top + rect.height - 1 };
        }
      }

      const started = originalStart(startPoint);
      if (!started || !this.calc) return started;

      const direction = this.calc.getDirection();
      book.classList.toggle(
        "is-turning-to-back-cover",
        currentPhysicalPage === LAST_PHYSICAL_PAGE - 2 && direction === 0
      );
      return started;
    };

    controller.do = function (point) {
      originalDo(point);
      if (!this.calc || !book.classList.contains("is-turning-to-back-cover")) return;

      const rawProgress = Math.min(100, Math.max(0, this.calc.getFlippingProgress()));
      const closingProgress = 100 * Math.pow(rawProgress / 100, 1.18);
      book.style.setProperty("--closing-page-progress", `${closingProgress}%`);
    };

    controller.animateFlippingTo = function (from, to, completeTurn, cleanup = true) {
      if (!completeTurn || !this.calc) {
        return originalAnimate(from, to, completeTurn, cleanup);
      }

      const bounds = this.getBoundsRect();
      const topTurn = this.calc.getCorner() === "top";
      const bendY = topTurn ? bounds.height * .14 : bounds.height * .86;
      const settleY = topTurn ? bounds.height * .08 : bounds.height * .92;
      const control1 = { x: bounds.pageWidth * .55, y: bendY };
      const control2 = { x: -bounds.pageWidth * .35, y: settleY };
      const steps = 1000;
      const frames = [];

      for (let step = 0; step <= steps; step += 1) {
        const time = step / steps;
        // Start the fold promptly, then slow the sheet as it settles across
        // the binding so the second half never reads as a lateral slide.
        const progress = Math.pow(time, .72);
        const inverse = 1 - progress;
        const point = {
          x: inverse ** 3 * from.x
            + 3 * inverse ** 2 * progress * control1.x
            + 3 * inverse * progress ** 2 * control2.x
            + progress ** 3 * to.x,
          y: inverse ** 3 * from.y
            + 3 * inverse ** 2 * progress * control1.y
            + 3 * inverse * progress ** 2 * control2.y
            + progress ** 3 * to.y
        };
        frames.push(() => this.do(point));
      }

      this.render.startAnimation(frames, this.app.getSettings().flippingTime, () => {
        if (!this.calc) return;
        this.calc.getDirection() === 1 ? this.app.turnToPrevPage() : this.app.turnToNextPage();
        if (cleanup) {
          this.render.setBottomPage(null);
          this.render.setFlippingPage(null);
          this.render.clearShadow();
          this.setState("read");
          this.reset();
        }
      });
    };
  }

  async function start() {
    buildThumbnails();
    bindInteractions();
    await preloadAllSources();
    buildPhysicalPages();

    const requested = Number(window.location.hash.replace("#page=", ""));
    const initialLogical = requested >= 1 && requested <= TOTAL_LOGICAL_PAGES ? requested : 1;
    const initialPhysical = logicalToPhysical(initialLogical);
    const flipDuration = REDUCED_MOTION.matches ? 1 : 1250;

    pageFlip = new St.PageFlip(book, {
      width: 1000,
      height: 1469,
      size: "stretch",
      minWidth: 160,
      maxWidth: 1000,
      minHeight: 235,
      maxHeight: 1469,
      startPage: initialPhysical,
      drawShadow: true,
      flippingTime: flipDuration,
      usePortrait: false,
      autoSize: true,
      maxShadowOpacity: .24,
      showCover: true,
      mobileScrollSupport: false,
      swipeDistance: 36,
      showPageCorners: false,
      disableFlipByClick: false
    });

    pageFlip.on("init", () => {
      pageFlip.getPage(0).setDensity("soft");
      pageFlip.getPage(LAST_PHYSICAL_PAGE).setDensity("soft");
      updateCurrentPage(initialPhysical);
      loadingCard.classList.add("is-hidden");
      window.setTimeout(() => { loadingCard.hidden = true; }, 230);
    });
    pageFlip.on("flip", (event) => updateCurrentPage(Number(event.data)));
    pageFlip.on("changeState", (event) => {
      if (event.data === "read") {
        book.classList.remove("is-turning-to-back-cover");
        book.style.removeProperty("--closing-page-progress");
      }
    });
    pageFlip.loadFromHTML(document.querySelectorAll(".book-page"));
    installNaturalTurnPath(pageFlip);

    // Keep the cover layout, but animate both covers like flexible paper.
    [0, LAST_PHYSICAL_PAGE].forEach((index) => {
      const page = pageFlip.getPage(index);
      page.setDensity("soft");
      page.setDrawingDensity("soft");
    });
  }

  start().catch(() => {
    loadingCard.textContent = "页面装帧失败，请刷新后重试。";
  });
})();
