export {};

declare const emfont: any;

type FontListItem = {
  id: string;
  name: string;
  weight: Array<string | number>;
  author?: string | null;
  name_zh?: string | null;
  name_en?: string | null;
  category?: string | null;
  tags: string[];
  family?: string | null;
  sid?: number | string | null;
};

type FontInfo = {
  name: {
    original?: string;
    zh?: string;
    en?: string;
  };
  weight: Array<string | number>;
  tag: string[];
  family?: string | null;
  version?: string | null;
  license?: string | null;
  source?: string | null;
  author?: string | null;
  description?: string | null;
  format?: string | null;
  sid?: number | string | null;
};

const apiBase = document.documentElement.dataset.apiBase?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => `${apiBase}${path}`;

const icon = (name: "arrowLeft" | "code" | "copy" | "download") => {
  const paths = {
    arrowLeft: `<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>`,
    copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>`,
    download: `<path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path>`,
    code: `<path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path>`
  };

  return `<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

const weightChart: Record<string, [string, string]> = {
  100: ["T", "Thin"],
  200: ["EL", "Extra Light"],
  300: ["L", "Light"],
  350: ["N", "Normal"],
  400: ["R", "Regular"],
  450: ["R", "Book"],
  500: ["M", "Medium"],
  600: ["SB", "Semi Bold"],
  700: ["B", "Bold"],
  800: ["EB", "Extra Bold"],
  900: ["H", "Heavy"],
  950: ["XH", "Extra Heavy"]
};

const pages = ["home", "about", "font", "fonts", "login", "logout", "dashboard"];
const families = new Set<string>();
const tags = new Set<string>();
const categories = new Set<string>();

let fontList: FontListItem[] = [];
let demoContent: Record<string, string> = {};
let demoContentPromise: Promise<void>;

function getElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element as T;
}

function marqueeSet() {
  const marquees = document.querySelectorAll<HTMLElement>("#section-home > div");
  for (const marquee of marquees) {
    const inner = marquee.querySelector("span");
    if (!inner) continue;
    const marqueeWidth = inner.getBoundingClientRect().width;
    if (!marqueeWidth) continue;
    marquee.style.setProperty("--innerWidth", `${-marqueeWidth}px`);
    marquee.innerHTML = `<span>${inner.textContent ?? ""}</span>${(inner.textContent ?? "").repeat(Math.ceil(window.outerWidth / marqueeWidth))}`;
  }
}

async function loadDemo() {
  try {
    const res = await fetch(apiUrl("/lorem"));
    demoContent = await res.json();
  } catch (error) {
    console.error("Failed to load demo content:", error);
    demoContent = {};
  }
}

function paramFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  getElement<HTMLInputElement>("#search-input").value = urlParams.get("q") ?? "";

  const urlCategories = urlParams.get("category")?.split(",") ?? [];
  for (const category of urlCategories) {
    const el = document.querySelector<HTMLInputElement>(`.cat-${CSS.escape(category)}`);
    if (el) el.checked = true;
  }

  const urlTags = urlParams.get("tags")?.split(",") ?? [];
  for (const tag of urlTags) {
    const el = document.querySelector<HTMLInputElement>(`.tag-${CSS.escape(tag)}`);
    if (el) el.checked = true;
  }

  getElement<HTMLSelectElement>("#family").value = urlParams.get("family") || "all";
}

async function updateFontDisplay(event?: Event | null, animationOff = false) {
  await demoContentPromise;

  const eventTarget = event?.target as HTMLElement | null;
  if (eventTarget?.classList[0]?.includes("cat")) {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(".category input:checked");
    checkboxes.forEach(checkbox => {
      if (checkbox !== eventTarget) checkbox.checked = false;
    });
  }

  if (!animationOff) window.scrollTo(0, 0);

  const selectedTags = [...document.querySelectorAll<HTMLInputElement>(".tags input:checked")].map(input => input.classList[0].replace("tag-", ""));
  const selectedCategories = [...document.querySelectorAll<HTMLInputElement>(".category input:checked")].map(input => input.classList[0].replace("cat-", ""));
  const family = getElement<HTMLSelectElement>("#family").value;
  const searchFont = getElement<HTMLInputElement>("#search-input").value;
  const searchText = getElement<HTMLTextAreaElement>("#search-test");
  const container = getElement("#section-search");

  const filtered = fontList.filter(font => {
    const matchName = !searchFont || `${font.id}${font.name_zh ?? ""}${font.name_en ?? ""}${font.name}`.toLowerCase().includes(searchFont.toLowerCase());
    const matchFamily = family === "all" || font.family === family;
    const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(font.category ?? "");
    const matchTags = selectedTags.length === 0 || selectedTags.every(tag => font.tags.includes(tag));
    return matchName && matchFamily && matchCategory && matchTags;
  });

  const min = searchText.value ? "" : "-min";
  if (filtered.length === fontList.length) filtered.sort(() => Math.random() - 0.5);

  container.innerHTML = filtered
    .map(font => {
      const weightStr = font.weight
        .map(weight => {
          const weightInfo = weightChart[String(weight)];
          return weightInfo ? `<span class="${weightInfo[0]}">${weightInfo[0]}</span>` : `<span>${weight}</span>`;
        })
        .join(" ⋅ ") || "暫時無法使用";
      const defaultText = demoContent[String(font.sid)] || "我個人認為義大利麵就應該拌 42 號混泥土";
      const previewText = searchText.value || defaultText;
      return `<a class="font-item" href="/fonts/${encodeURIComponent(font.id)}" ${animationOff ? "style=animation:none" : ""}>
        <div class="font-title">
          <h3>${font.name}</h3>
          <div class="weight">${weightStr}&nbsp; | &nbsp;by ${font.author ?? "未知作者"}</div>
        </div>
        <div class="font-preview" data-class="emfont-${font.id}${min}">${previewText}</div>
      </a>`;
    })
    .join("");

  addClassToVisibleElements();
  if (!container.innerHTML) {
    container.innerHTML = `<div class="no-result"><div class="╯°□°╯">(╯°□°)╯︵ ┻┻</div>你要求太多了吧！<br>沒找到想要的字體嗎？歡迎到 <a href="https://github.com/emfont/emfont/issues/new/choose">GitHub</a> 推薦給我們！</div>`;
  } else {
    window.setTimeout(addClassToVisibleElements, 300);
  }
}

async function initSearch() {
  const res = await fetch(apiUrl("/list"));
  fontList = await res.json();
  fontList.forEach(font => {
    if (font.family) families.add(font.family);
    font.tags.forEach(tag => tags.add(tag));
    if (font.category) categories.add(font.category);
  });

  const familySelect = getElement<HTMLSelectElement>("#family");
  families.forEach(family => {
    const option = document.createElement("option");
    option.value = family;
    option.textContent = family;
    familySelect.appendChild(option);
  });

  const tagContainer = getElement(".tags");
  tags.forEach(tag => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" class="tag-${tag}" />${tag}`;
    tagContainer.appendChild(label);
  });

  const categoryContainer = getElement(".category");
  categories.forEach(category => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" name="cat" class="cat-${category}" />${category}`;
    categoryContainer.appendChild(label);
  });

  paramFromUrl();
  await updateFontDisplay();

  document.querySelectorAll(".search-container input, .search-container select").forEach(input => {
    input.addEventListener("change", event => updateFontDisplay(event));
  });

  let debounceTimer = 0;
  getElement<HTMLTextAreaElement>("#search-test").addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => updateFontDisplay(null, true), 400);
  });
}

function isElementOutsideViewport(el: Element) {
  const rect = el.getBoundingClientRect();
  return rect.bottom < -200 || rect.top > window.innerHeight + 200;
}

function addClassToVisibleElements() {
  if (!getElement("main").classList.contains("fonts")) return;
  document.querySelectorAll<HTMLElement>(".font-preview").forEach(preview => {
    const className = preview.getAttribute("data-class");
    if (!className || isElementOutsideViewport(preview) || preview.classList.contains(className)) return;

    preview.classList.add(className);
    preview.style.color = "transparent";
    emfont
      .init({
        root: preview,
        cache: false
      })
      .then((results: Array<{ status: string }>) => {
        results.forEach(result => {
          preview.style.color = result.status === "fulfilled" ? "var(--slate-100)" : "#702525";
        });
      });
  });
}

async function loadFontInfo(fontId: string) {
  await demoContentPromise;

  const container = getElement(".info-container.fontPage-container");
  const weightContainer = getElement(".font-weights");
  weightContainer.innerHTML = `<div class="font-item loading"><div class="font-title"><div class="weight">Regular 400</div></div><div class="font-preview"></div></div>`;
  container.innerHTML = `<div class="loading"><a class="navigation" href="/fonts">${icon("arrowLeft")}字型</a><h1>字字字字字</h1><p>字字字字字</p><div class="font-tags"><a class="tag">AA</a></div><div class="font-actions"><div class="font-class">A</div><span class="icon-placeholder"></span><span class="icon-placeholder"></span></div><p class="font-description">字字字字字字字字字字字字字字字字字字字字字字字字字字字字</p></div>`;

  const res = await fetch(apiUrl(`/info/${encodeURIComponent(fontId)}`));
  const font: FontInfo | { status: string; message: string } = await res.json();
  if ("status" in font) {
    getElement("main").classList.value = "notFound";
    return;
  }

  document.title = `${font.name.original ?? fontId} - emfont`;
  const sourceUrl = font.source?.endsWith("/") ? font.source.slice(0, -1) : font.source || "#";
  const download = sourceUrl + (sourceUrl.startsWith("https://github.com/") ? "/releases/latest" : "");

  container.innerHTML = `<a class="navigation" href="/fonts">${icon("arrowLeft")}字型</a>
    <h1>${font.name.original ?? fontId}</h1>
    <p>${font.name.zh ?? ""}</p>
    <div class="font-tags">${font.tag.map(tag => `<a class="tag" href="/fonts?tags=${encodeURIComponent(tag)}">${tag}</a>`).join("")}</div>
    <div class="font-actions">
      <div class="font-class"><div>${fontId}</div><div id="copyClass">${icon("copy")}</div></div>
      <a href="${sourceUrl}" target="_blank" rel="noopener" aria-label="來源網站">${icon("code")}</a>
      <a href="${download}" target="_blank" rel="noopener" aria-label="下載字型">${icon("download")}</a>
    </div>
    <p class="font-description">${font.description ?? ""}</p>
    <p class="font-info">
      字型家族：<a href="/fonts?family=${encodeURIComponent(font.family ?? "")}">${font.family ?? ""}</a><br>
      作者：<a href="/fonts?q=${encodeURIComponent(font.author ?? "")}">${font.author ?? ""}</a><br>
      版本：${font.version ?? ""}<br>
      版權：${font.license ?? ""}
    </p>`;

  const min = getElement<HTMLTextAreaElement>("#search-test").value ? "" : "-min";
  const defaultText = demoContent[String(font.sid)] || "字型展示文字";
  const inputText = getElement<HTMLTextAreaElement>("#search-test").value || defaultText;
  weightContainer.innerHTML = "";

  font.weight.forEach(weight => {
    const weightDiv = document.createElement("div");
    const weightInfo = weightChart[String(weight)];
    weightDiv.innerHTML = `<div class="font-item">
      <div class="font-title">
        <div class="weight">${weightInfo ? weightInfo[1] : "未知字重"} ${weight}</div>
        <div><a href="${apiUrl(`/file/original-fonts/${fontId}/${weight}.${font.format ?? "ttf"}`)}" aria-label="下載原始字型">${icon("download")}</a></div>
      </div>
      <div class="font-preview emfont-${fontId}${min}-${weight}" contenteditable="true">${inputText}</div>
    </div>`;
    weightContainer.appendChild(weightDiv);
    const preview = weightDiv.querySelector<HTMLElement>(".font-preview");
    if (!preview) return;
    preview.style.color = "transparent";
    emfont
      .init({
        root: weightDiv,
        cache: false
      })
      .then((result: Array<{ status: string }>) => {
        if (result.length === 0) return;
        preview.style.color = result[0].status === "fulfilled" ? "var(--slate-100)" : "#702525";
        let debounceTimer = 0;
        preview.addEventListener("input", () => {
          window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => emfont.init({ root: preview, tofu: true }), 300);
        });
      });
  });

  if (!weightContainer.innerHTML) weightContainer.innerHTML = `<div class="no-result"><div class="╯°□°╯">¯\_(ツ)_/¯</div>這個字體暫時無法使用。</div>`;

  container.querySelector<HTMLElement>(".font-class")?.addEventListener("click", event => {
    const target = event.currentTarget as HTMLElement;
    navigator.clipboard.writeText(target.innerText).then(() => {
      target.style.setProperty("--background", "rgb(59, 88, 49)");
      window.setTimeout(() => target.style.setProperty("--background", "var(--slate-700)"), 2000);
    });
  });
}

function updateMain(path = window.location.pathname) {
  const urlParts = path.split("?")[0].split("/");
  let mainClass = urlParts[1].replace("index.html", "") || "home";
  if (!pages.includes(mainClass)) mainClass = "notFound";

  getElement<HTMLInputElement>("#mobileToggle").checked = mainClass === "fonts";
  getElement("#section-search").innerHTML = `<div class="font-item loading"><div class="font-title"><div class="weight">AAAAAAAAAAAAA</div></div><div class="font-preview"></div></div>`.repeat(10);

  switch (mainClass) {
    case "home": {
      let delay = 0;
      if (path === "/fonts") {
        getElement("main").classList.add("fonts-toHome");
        delay = 300;
      }
      window.setTimeout(() => {
        getElement("main").classList.value = "home";
        marqueeSet();
      }, delay);
      document.title = "emfont - 免費中文字體 Webfont 服務";
      break;
    }
    case "fonts":
      if (urlParts.length > 2 && urlParts[2].length > 0) {
        getElement("main").classList.value = "fonts-toFont font";
        window.setTimeout(() => getElement("main").classList.remove("fonts-toFont"), 300);
        loadFontInfo(decodeURIComponent(urlParts[2]));
      } else {
        getElement("main").classList.value = "fonts";
        addClassToVisibleElements();
        document.title = "字體 - emfont";
      }
      if (fontList.length) {
        paramFromUrl();
        updateFontDisplay(null, true);
      }
      break;
    default:
      document.title = mainClass === "notFound" ? "找不到頁面 - emfont" : mainClass === "login" ? "登入 - emfont" : mainClass === "about" ? "關於 - emfont" : `${mainClass} - emfont`;
      getElement("main").classList.value = mainClass;
      break;
  }
}

function initSite() {
  emfont?.init?.({
    tofu: true
  });

  window.addEventListener("resize", () => {
    if (getElement("main").classList.contains("home")) marqueeSet();
  });

  document.body.addEventListener("click", event => {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || event.ctrlKey || event.metaKey || link.target) return;
    if (!href.startsWith("/")) return;
    if (href.startsWith("/docs") || href.startsWith("/admin") || href.startsWith("/api") || href.startsWith("/css") || href.startsWith("/g") || href.startsWith("/file")) return;
    event.preventDefault();
    history.pushState({}, "", href);
    updateMain(href);
  });

  fetch(apiUrl("/bulletin"))
    .then(response => response.json())
    .then(data => {
      if (!data.message) return;
      const bulletin = getElement("#bulletin");
      getElement("#bulletin p").innerText = data.message;
      bulletin.style.display = "block";
    })
    .catch(error => console.error("Error fetching bulletin:", error));

  getElement("#closeBulletin").addEventListener("click", () => {
    getElement("#bulletin").style.display = "none";
  });

  demoContentPromise = loadDemo();
  initSearch().catch(error => console.error("Failed to initialize font search:", error));
  document.addEventListener("scroll", addClassToVisibleElements);
  addClassToVisibleElements();
  updateMain();
  window.addEventListener("popstate", () => updateMain());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite);
} else {
  initSite();
}
