/* ============================================================
   script.js — 無人簽收
   只負責「行為」。所有可編輯內容都在 data.js。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- DOM 參照 ---------- */
  const homeScreen   = document.getElementById("home-screen");
  const storyScreen  = document.getElementById("story-screen");
  const homeBg       = document.getElementById("homeBg");
  const storyBg      = document.getElementById("storyBg");
  const exhibitList  = document.getElementById("exhibitList");
  const backBtn      = document.getElementById("backBtn");
  const storyScroll  = document.getElementById("storyScroll");

  const pageTitle       = document.getElementById("pageTitle");
  const pageDescription = document.getElementById("pageDescription");
  const homeEyebrow     = document.getElementById("homeEyebrow");
  const homeTitle       = document.getElementById("homeTitle");
  const homeSubtitle    = document.getElementById("homeSubtitle");
  const homeStats       = document.getElementById("homeStats");

  const storyEyebrow = document.getElementById("storyEyebrow");
  const storyTitle   = document.getElementById("storyTitle");
  const storyHint    = document.getElementById("storyHint");

  const carousel        = document.getElementById("carousel");
  const carouselDragLayer = document.getElementById("carouselDragLayer");
  const carouselDots    = document.getElementById("carouselDots");
  const slotLeft   = document.getElementById("slotLeft");
  const slotCenter = document.getElementById("slotCenter");
  const slotRight  = document.getElementById("slotRight");

  const storyTextWrap = document.getElementById("storyTextWrap");
  const storySpeaker  = document.getElementById("storySpeaker");
  const storyText     = document.getElementById("storyText");
  const systemNoteWrap = document.getElementById("systemNoteWrap");
  const systemNoteText = document.getElementById("systemNoteText");

  const SLOTS = { left: slotLeft, center: slotCenter, right: slotRight };

  /* ---------- 狀態 ---------- */
  let currentExhibit = null;
  let centerIndex = 1; // 預設「我」在中間
  let dragState = null;
  let suppressClick = false; // 避免拖曳結束後又誤觸 click 造成重複切換

  const SWIPE_THRESHOLD = 46;   // px，超過這個距離才觸發切換
  const DRAG_DAMP = 0.72;       // 拖曳跟手係數
  const DRAG_MAX = 150;         // 拖曳最大視覺位移

  /* ============================================================
     圖片 fallback：找不到圖片時顯示 placeholder，不讓網站壞掉
     ============================================================ */
  function setImageWithFallback(imgEl, containerEl, src) {
    containerEl.classList.remove("img-missing");
    if (!src) {
      containerEl.classList.add("img-missing");
      imgEl.removeAttribute("src");
      return;
    }
    imgEl.onerror = function () {
      containerEl.classList.add("img-missing");
    };
    imgEl.onload = function () {
      containerEl.classList.remove("img-missing");
    };
    imgEl.src = src;
  }

  /* ============================================================
     首頁：依 data.js 動態產生展品列表
     ============================================================ */
  function renderHomeList() {
    exhibitList.innerHTML = "";

    const exhibitData = window.exhibits || [];
    exhibitData.forEach(function (exhibit, i) {
      const li = document.createElement("li");
      li.className = "manifest-item";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "manifest-btn";
      btn.setAttribute("aria-label", exhibit.title + " " + exhibit.subtitle);

      const num = document.createElement("span");
      num.className = "manifest-num";
      num.textContent = String(i + 1).padStart(2, "0");

      const thumb = document.createElement("span");
      thumb.className = "manifest-thumb";
      const thumbImg = document.createElement("img");
      thumbImg.alt = exhibit.title;
      setImageWithFallback(thumbImg, thumb, exhibit.coverImage);
      thumb.appendChild(thumbImg);

      const text = document.createElement("span");
      text.className = "manifest-text";
      const title = document.createElement("span");
      title.className = "manifest-title";
      title.textContent = exhibit.title;
      const subtitle = document.createElement("span");
      subtitle.className = "manifest-subtitle";
      subtitle.textContent = exhibit.subtitle;
      text.appendChild(title);
      text.appendChild(document.createElement("br"));
      text.appendChild(subtitle);

      const arrow = document.createElement("span");
      arrow.className = "manifest-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";

      btn.appendChild(num);
      btn.appendChild(thumb);
      btn.appendChild(text);
      btn.appendChild(arrow);
      btn.addEventListener("click", function () {
        openExhibit(exhibit.id);
      });

      li.appendChild(btn);
      exhibitList.appendChild(li);
    });
  }

  /* ============================================================
     背景圖片設定（找不到圖片時，CSS 的底色會自動當 fallback）
     ============================================================ */
  function setBackground(el, src) {
    el.style.backgroundImage = src ? "url('" + src + "')" : "none";
  }

  /* ============================================================
     開啟 / 返回 展品
     ============================================================ */
  function openExhibit(id) {
    const exhibit = (window.exhibits || []).find(function (e) { return e.id === id; });
    if (!exhibit) return;

    currentExhibit = exhibit;
    centerIndex = 1;

    setBackground(storyBg, exhibit.backgroundImage);
    storyEyebrow.textContent = "EXHIBIT / " + String(exhibit.id).padStart(2, "0");
    storyTitle.textContent = exhibit.title;
    storyHint.textContent = exhibit.hint || "左右滑動，看看他們記得的故事。";

    

    buildDots(exhibit.characters.length);
    renderSlots(false);
    renderStory(exhibit.characters[centerIndex], false);

    storyScroll.scrollTop = 0;
    storyScreen.classList.add("active");
    homeScreen.classList.remove("active");
  }

  function goHome() {
    homeScreen.classList.add("active");
    storyScreen.classList.remove("active");
  }

  backBtn.addEventListener("click", goHome);

  /* ============================================================
     三角色旋轉：依 centerIndex 決定 left / center / right 內容
     ============================================================ */
  function buildDots(count) {
    carouselDots.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("span");
      carouselDots.appendChild(dot);
    }
  }

  function updateDots() {
    const dots = carouselDots.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("is-active", i === centerIndex);
    }
  }

  function fillSlot(slotEl, character) {
    const img = slotEl.querySelector(".char-img");
    const fallback = slotEl.querySelector(".char-fallback");
    const nameEl = slotEl.querySelector(".char-name");

    nameEl.textContent = character.name;
    setImageWithFallback(img, slotEl, character.image);
    img.alt = character.name;
    fallback.setAttribute("aria-hidden", "true");
  }

  function renderSlots() {
    const chars = currentExhibit.characters;
    const leftIndex  = (centerIndex + chars.length - 1) % chars.length;
    const rightIndex = (centerIndex + 1) % chars.length;

    fillSlot(slotLeft, chars[leftIndex]);
    fillSlot(slotCenter, chars[centerIndex]);
    fillSlot(slotRight, chars[rightIndex]);

    slotLeft.dataset.index = leftIndex;
    slotCenter.dataset.index = centerIndex;
    slotRight.dataset.index = rightIndex;

    updateDots();
  }

  /* ---------- 故事文字：fade out -> 換字 -> fade in ---------- */
  let storyFadeTimer = null;
  
function renderStory(character, animate) {
  function updateContent() {
    storySpeaker.textContent = character.name;
    storyText.textContent = character.story;

    // 依照角色顯示專屬系統備註
    const note = (character.systemNote || "").trim();

    if (systemNoteText && systemNoteWrap) {
      systemNoteText.textContent = note;
      systemNoteWrap.hidden = !note;
    }
  }

  if (!animate) {
    clearTimeout(storyFadeTimer);
    storyTextWrap.classList.remove("is-fading");
    updateContent();
    return;
  }

  clearTimeout(storyFadeTimer);
  storyTextWrap.classList.add("is-fading");

  storyFadeTimer = setTimeout(function () {
    updateContent();
    storyTextWrap.classList.remove("is-fading");
  }, 220);
}


  /* ---------- 旋轉一格：dir = +1 (向左滑 / 下一位) ｜ -1 (向右滑 / 上一位) ---------- */
  function rotate(dir) {
    if (!currentExhibit) return;
    const len = currentExhibit.characters.length;
    centerIndex = (centerIndex + dir + len) % len;
    renderSlots();
    renderStory(currentExhibit.characters[centerIndex], true);
  }

  /* ============================================================
     拖曳 / 滑動互動（Pointer Events，支援手指與滑鼠）
     ============================================================ */
  function resetDragLayer(animated) {
    carouselDragLayer.style.transition = animated
      ? "transform 0.4s cubic-bezier(0.22,0.61,0.36,1)"
      : "none";
    carouselDragLayer.style.transform = "translateX(0px)";
  }

  carousel.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) return; // 只接受主要按鍵
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      locked: null, // 'x' | 'y'
      pointerId: e.pointerId,
      startTarget: e.target
    };
  });

  carousel.addEventListener("pointermove", function (e) {
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    dragState.dx = dx;
    dragState.dy = dy;

    if (!dragState.locked) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dragState.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (dragState.locked === "x") {
          try { carousel.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }
    }

    if (dragState.locked === "x") {
      e.preventDefault();
      const damped = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, dx * DRAG_DAMP));
      carouselDragLayer.style.transition = "none";
      carouselDragLayer.style.transform = "translateX(" + damped + "px)";
    }
    // locked === 'y' -> 交給瀏覽器自然上下捲動，不做任何事
  }, { passive: false });

  function endDrag(e) {
    if (!dragState || (e.pointerId !== undefined && dragState.pointerId !== e.pointerId)) return;

    const wasHorizontal = dragState.locked === "x";
    const dx = dragState.dx;
    dragState = null;
    // 只有「真的有明顯拖曳」時才封鎖後續 click，避免點擊時滑鼠些微晃動
    // 就誤判成拖曳，導致點擊角色沒有反應。
    suppressClick = wasHorizontal && Math.abs(dx) > 20;

    if (wasHorizontal && Math.abs(dx) > SWIPE_THRESHOLD) {
      const dir = dx < 0 ? 1 : -1; // 往左拖 -> 下一位 (dir +1)
      rotate(dir);
      resetDragLayer(true);
    } else {
      resetDragLayer(true);
    }
  }

  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);
  carousel.addEventListener("pointerleave", function (e) {
    // 滑鼠移出範圍時，若正在拖曳則視為放開
    if (dragState && e.pointerId === dragState.pointerId && e.pressure === 0) {
      endDrag(e);
    }
  });

  /* ---------- 點擊左右角色也能直接切換（桌機/輔助操作用） ---------- */
  slotLeft.addEventListener("click", function () {
    if (suppressClick) { suppressClick = false; return; }
    rotate(-1);
  });
  slotRight.addEventListener("click", function () {
    if (suppressClick) { suppressClick = false; return; }
    rotate(1);
  });

  // slotLeft / slotRight 是 div（role="button"），鍵盤 Enter / 空白鍵
  // 不會像原生 <button> 一樣自動觸發 click，這裡手動補上。
  [slotLeft, slotRight].forEach(function (slotEl) {
    slotEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        slotEl.click();
      }
    });
  });

  /* ---------- 鍵盤左右鍵（桌面輔助操作） ---------- */
  document.addEventListener("keydown", function (e) {
    if (!storyScreen.classList.contains("active")) return;
    if (e.key === "ArrowLeft") rotate(-1);
    if (e.key === "ArrowRight") rotate(1);
    if (e.key === "Escape") goHome();
  });

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    const config = window.siteConfig || {};
    const exhibits = window.exhibits || [];
    const exhibitionName = config.exhibitionName || "遺憾轉運站";
    const englishLabel = config.englishLabel || "EXHIBITION";
    const subtitle = config.homeSubtitle || "選擇一件貨物，看看它背後留下的故事。";

    if (homeTitle) homeTitle.textContent = exhibitionName;
    if (homeEyebrow) homeEyebrow.textContent = englishLabel + " / NPC Project X Bridge 陳橋 " ;
    if (homeSubtitle) homeSubtitle.textContent = subtitle;
    if (homeStats) homeStats.textContent = "共 " + exhibits.length + " 件貨物 · 3 種視角 · 15 段故事";
    if (pageTitle) pageTitle.textContent = exhibitionName + "｜互動故事展覽";
    if (pageDescription) pageDescription.setAttribute("content", exhibitionName + "——" + subtitle);

    renderHomeList();
    setBackground(homeBg, exhibits.length ? "images/home-bg.jpg" : null);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();



// ===== 系統備註彈窗控制 =====

function initSystemNoteModal() {
  const noteButton = document.getElementById("systemNoteButton");
  const noteModal = document.getElementById("systemNoteModal");
  const noteClose = document.getElementById("systemNoteClose");

  if (!noteButton || !noteModal || !noteClose) return;

  // 開啟彈窗
  noteButton.addEventListener("click", () => {
    if (!noteModal.open) {
      noteModal.showModal();
    }
  });

  // 點擊右上角 X 關閉
  noteClose.addEventListener("click", () => {
    noteModal.close();
  });

  // 點擊彈窗外部關閉
  noteModal.addEventListener("click", (event) => {
    const rect = noteModal.getBoundingClientRect();

    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      noteModal.close();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSystemNoteModal);
} else {
  initSystemNoteModal();
}
