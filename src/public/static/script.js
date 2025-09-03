emfont.init({
    tofu: true
    // colorTest: true
});

const marqueeSet = () => {
    const marquees = document.querySelectorAll("#section-home > div");
    for (const marquee of marquees) {
        const inner = marquee.querySelector("span");
        const marqueeWidth = inner.getBoundingClientRect().width;
        marquee.style.setProperty("--innerWidth", `${-marqueeWidth}px`);
        marquee.innerHTML = "<span>" + inner.innerText + "</span>" + inner.innerText.repeat(Math.ceil(window.outerWidth / marqueeWidth));
    }
};

window.addEventListener("resize", () => {
    if (document.querySelector("main").classList.contains("home")) marqueeSet();
});

const pages = ["home", "about", "font", "fonts", "login", "logout", "dashboard"];
const mobileToggle = document.getElementById("mobileToggle");

document.body.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (event.ctrlKey || event.metaKey) return;
    if (!href.startsWith("/")) return;
    if (href.startsWith("/docs")) return;
    event.preventDefault();
    history.pushState({}, "", href);
    updateMain(href);
});

// fetch bppletin, if message is not empty show bulletin
fetch("/bulletin")
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            const bulletin = document.querySelector("#bulletin");
            bulletin.querySelector("p").innerText = data.message;
            bulletin.style.display = "block";
        }
    })
    .catch(error => console.error("Error fetching bulletin:", error));

document.getElementById("closeBulletin").addEventListener("click", () => {
    document.getElementById("bulletin").style.display = "none";
});
const weightChart = {
    100: ["T", "Thin"],
    200: ["EL", "Extra Light"],
    300: ["L", "Light"],
    350: ["N", "Normal"],
    400: ["R", "Regular"],
    500: ["M", "Medium"],
    600: ["SB", "Semi Bold"],
    700: ["B", "Bold"],
    800: ["EB", "Extra Bold"],
    900: ["H", "Heavy"],
    950: ["XH", "Extra Heavy"]
};

let fontList;
const families = new Set();
const tags = new Set();
const categories = new Set();
const searchText = document.querySelector("#search-test");
const container = document.getElementById("section-search");
let demo_content;
let demoContentPromise;

async function loadDemo() {
    try {
        const res = await fetch("/lorem");
        demo_content = await res.json();
    } catch (error) {
        console.error("Failed to load demo content:", error);
        demo_content = {}; // Fallback to empty object
    }
}

demoContentPromise = loadDemo();
const updateFontDisplay = async (e, animationOff = false) => {
    await demoContentPromise; // Wait for demo content to be loaded

    if (e && e.target.classList[0].includes("cat")) {
        const checkboxes = document.querySelectorAll(".category input:checked");
        checkboxes.forEach(checkbox => {
            if (checkbox !== e.target) checkbox.checked = false;
        });
    }

    if (!animationOff) window.scrollTo(0, 0);

    const tags = [...document.querySelectorAll(".tags input:checked")].map(i => i.classList[0].replace("tag-", ""));
    const categories = [...document.querySelectorAll(".category input:checked")].map(i => i.classList[0].replace("cat-", ""));
    const family = document.getElementById("family").value;
    const searchFont = document.getElementById("search-input").value;
    const filtered = fontList.filter(font => {
        const matchName = !searchFont || (font.id + font.name_zh + font.name_en + font.name).toLowerCase().includes(searchFont.toLowerCase());
        const matchFamily = family === "all" || font.family === family;
        const matchCategory = categories.length === 0 || categories.includes(font.category);
        const matchTags = tags.length === 0 || tags.every(tag => font.tags.includes(tag));
        return matchName && matchFamily && matchCategory && matchTags;
    });
    const min = searchText.value ? "" : "-min";
    let containerHTML = "";
    // 打亂前端排序字型顯示排序
    if (filtered.length == fontList.length) {
        filtered.sort(() => Math.random() - 0.5);
    }
    filtered.forEach(font => {
        const parts = [];
        for (let weight in font.weight) {
            weight = font.weight[weight];
            if (weightChart[weight]) {
                parts.push(`<span class="${weightChart[weight][0]}">${weightChart[weight][0]}</span>`);
            } else parts.push(`<span>${weight}</span>`);
        }
        weightStr = parts.join(" ⋅ ");
        if (!weightStr) weightStr = "暫時無法使用";
        const default_text = demo_content[font.sid] || "我個人認為義大利麵就應該拌 42 號混泥土";
        const previewText = searchText.value || default_text;
        containerHTML += `<a class="font-item" href="/fonts/${encodeURIComponent(font.id)}" ${animationOff ? "style=animation:none" : ""}>
                    <div class="font-title">
                        <h3>${font.name}</h3>
                        <div class="weight">
                            ${weightStr}&nbsp; | &nbsp;by ${font.author}
                        </div>
                    </div>
                    <div class="font-preview" data-class="emfont-${font.id}${min}">${previewText}</div>
                </a>
            `;
    });
    container.innerHTML = containerHTML;
    addClassToVisibleElements();
    if (container.innerHTML == "") {
        container.innerHTML = `<div class="no-result"><div class="╯°□°╯">(╯°□°)╯︵ ┻┻</div>你要求太多了吧！<br>沒找到想要的字體嗎？歡迎到 <a href=https://github.com/emfont/emfont/issues/new/choose>GitHub</a> 推薦給我們！</div>`;
    } else {
        setTimeout(() => {
            addClassToVisibleElements();
        }, 300);
    }
};

const paramFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    document.getElementById("search-input").value = urlParams.get("q");
    let cals = urlParams.get("category");
    if (cals) {
        cals = cals.split(",");
        for (const cal of cals) {
            const el = document.querySelector(".cat-" + cal);
            if (el) el.checked = true;
        }
    }
    let urlTags = urlParams.get("tags");
    if (urlTags) {
        urlTags = tags.split(",");
        for (const tag of urlTags) {
            const el = document.querySelector(".tag-" + tag);
            if (el) el.checked = true;
        }
    }
    document.getElementById("family").value = urlParams.get("family") || "all";
};

const initSearch = async () => {
    const res = await fetch(`/list`);
    fontList = await res.json();
    fontList.forEach(font => {
        families.add(font.family);
        font.tags.forEach(tag => tags.add(tag));
        categories.add(font.category);
    });

    // Populate family <select>
    const familySelect = document.getElementById("family");
    families.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        familySelect.appendChild(opt);
    });

    const tagContainer = document.querySelector(".tags");
    tags.forEach(tag => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" class="tag-${tag}" />${tag}`;
        tagContainer.appendChild(label);
    });

    const categoryContainer = document.querySelector(".category");
    categories.forEach(cat => {
        const label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" name="cat" class="cat-${cat}" />${cat}`;
        categoryContainer.appendChild(label);
    });

    paramFromUrl();
    await updateFontDisplay(); // Wait for demo content to be loaded before calling updateFontDisplay
    document.querySelectorAll(".search-container input, .search-container select").forEach(input => {
        input.addEventListener("change", () => updateFontDisplay()); // 要用箭頭不然 e 會進去壞掉
    });

    let debounceTimer;
    searchText.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateFontDisplay(null, true);
        }, 400);
    });
};
initSearch();
// 綁定 input 事件

function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.bottom < -200 || rect.top > window.innerHeight + 200;
}

function addClassToVisibleElements() {
    if (!document.querySelector("main").classList.contains("fonts")) return;
    var aosElements = document.querySelectorAll(".font-preview");
    aosElements.forEach(function (aosElement) {
        const className = aosElement.getAttribute("data-class");
        if (!isElementInViewport(aosElement) && !aosElement.classList.contains(className)) {
            aosElement.classList.add(className);
            aosElement.style.color = "transparent";
            emfont
                .init({
                    root: aosElement,
                    cache: false
                })
                .then(results => {
                    results.forEach(result => {
                        if (result.status === "fulfilled") {
                            aosElement.style.color = "var(--slate-100)";
                        } else if (result.status === "rejected") {
                            aosElement.style.color = "#702525";
                        }
                    });
                });
        }
    });
}

document.addEventListener("scroll", addClassToVisibleElements);
addClassToVisibleElements();

const loadFontInfo = async fontId => {
    await demoContentPromise; // Wait for demo content to be loaded

    const container = document.querySelector(".info-container.fontPage-container");
    const weightContainer = document.querySelector(".font-weights");
    weightContainer.innerHTML = `<div class="font-item loading">
            <div class="font-title"><div class="weight">Regular 400</div></div>
            <div class="font-preview"></div></div>`;
    container.innerHTML = `<div class=loading><a class="navigation" href="/fonts"> <img src="/static/img/larr.svg" alt="">字型</a>
            <h1>字字字字字</h1><p>字字字字字</p>
            <div class="font-tags"><a class="tag">AA</a></div>
            <div class="font-actions">
                <div class="font-class">A</div>
                <img src="" alt="GitHub">
                <img src="" alt="GitHub">
            </div>
            <p class="font-description">字字字字字字字字字字字字字字字字字字字字字字字字字字字字</p></div>`;
    const res = await fetch(`/info/${fontId}`);
    const font = await res.json();
    if (font == { status: "failed", message: "Font not found" }) {
        document.querySelector("main").classList = "notFound";
        return;
    }
    document.title = `${font.name.original} - emfont`;
    const sourceUrl = font.source.endsWith("/") ? font.source.slice(0, -1) : font.source;
    font.download = sourceUrl + (sourceUrl.startsWith("https://github.com/") ? "/releases/latest" : "");
    container.innerHTML = `<a class="navigation" href="/fonts"> <img src="/static/img/larr.svg" alt="">字型 </a>
    <h1>${font.name.original}</h1>
    <p>${font.name.zh}</p>
    <div class="font-tags">
        ${font.tag.map(tag => `<a class="tag"  href="/fonts?tags=${tag}">${tag}</a>`).join("")}
    </div>
    <div class="font-actions">
        <div class="font-class">
            <div>emfont-${fontId}</div>
            <div id="copyClass"></div>
        </div>
        <a href="${font.source}" target="_blank">
            <img src="/static/img/GitHub-400.svg" alt="GitHub">
        </a>
        <a href="${font.download}" target="_blank">
            <img src="/static/img/download.svg" alt="official-Download-link">
        </a>
    </div>
    <p class="font-description">${font.description}</p>
    <p class="font-info">
        字型家族：<a href="/fonts?family=${font.family}">${font.family}</a><br>
        作者：<a href="/fonts?q=${font.author}">${font.author}</a><br>
        版本：${font.version}<br>
        版權：${font.license}
    </p>
    <div class="font-coverage" style="display: none;">
        <label for="coverage-tc">繁體字 (90%)</label>
        <div class="coverage-bar" id="coverage-tc" style="--percent: 90%"></div>
        <label for="coverage-sc">簡體字 (40%)</label>
        <div class="coverage-bar" id="coverage-sc" style="--percent: 40%"></div>
        <label for="coverage-en">英文 (100%)</label>
        <div class="coverage-bar" id="coverage-en" style="--percent: 100%"></div>
        <label for="coverage-jp">日文 (20%)</label>
        <div class="coverage-bar" id="coverage-jp" style="--percent: 20%"></div>
        <label for="coverage-ko">韓文 (30%)</label>
        <div class="coverage-bar" id="coverage-ko" style="--percent: 30%"></div>
    </div>`;
    const min = searchText.value ? "" : "-min";
    const default_text = demo_content[font.sid] || "字型展示文字";
    const inputText = searchText.value || default_text;
    weightContainer.innerHTML = "";
    font.weight.map(weight => {
        const weightDiv = document.createElement("div");
        weightDiv.innerHTML = `<div class="font-item">
            <div class="font-title">
                <div class="weight">${weightChart[weight][1]} ${weight}</div>
                <div>
                <a href="https://font.emtech.cc/file/original-fonts/${fontId}/${weight}.${font.format}">
                    <img src="/static/img/download.svg" alt="original-Download-link-from-emfont">
                </a></div>
            </div>
            <div class="font-preview emfont-${fontId}${min}-${weight}" contenteditable="true">${inputText}</div></div>`;
        weightContainer.appendChild(weightDiv);
        const weightDivPreview = weightDiv.querySelector(".font-preview");
        weightDivPreview.style.color = "translarent";
        emfont
            .init({
                root: weightDiv,
                cache: false
            })
            .then(result => {
                if (result.length == 0) return;
                if (result[0].status === "fulfilled") {
                    weightDivPreview.style.color = "var(--slate-100)";
                } else if (result[0].status === "rejected") {
                    weightDivPreview.style.color = "#702525";
                }
                let debounceTimer;
                weightDivPreview.addEventListener("input", () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        emfont.init({ root: weightDivPreview, tofu: true });
                    }, 300);
                });
            });
    });
    if (!weightContainer.innerHTML) weightContainer.innerHTML = `<div class="no-result"><div class="╯°□°╯">¯\_(ツ)_/¯</div>這個字體暫時無法使用。</div>`;

    container.querySelector(".font-class").onclick = e => {
        navigator.clipboard.writeText(e.currentTarget.innerText).then(() => {
            container.querySelector(".font-class").style.setProperty("--background", "rgb(59, 88, 49)");
            setTimeout(() => {
                container.querySelector(".font-class").style.setProperty("--background", " var(--slate-700)");
            }, 2000);
        });
    };
    //  addClassToVisibleElements();
};

const updateMain = (path = window.location.pathname) => {
    const urlParts = path.split("?")[0].split("/");
    let mainClass = urlParts[1].replace("index.html", "") || "";
    if (mainClass == "") mainClass = "home";
    if (!pages.includes(mainClass)) mainClass = "notFound";
    mobileToggle.checked = mainClass == "fonts";
    container.innerHTML = `<div class="font-item loading">
            <div class="font-title"><div class="weight">AAAAAAAAAAAAA</div></div>
            <div class="font-preview"></div></div>`.repeat(10);

    switch (mainClass) {
        case "home":
            let delay = 0;
            if (path == "/fonts") {
                document.querySelector("main").classList.add("fonts-toHome");
                delay = 300;
            }
            setTimeout(() => {
                document.querySelector("main").classList = "home";
                marqueeSet();
            }, delay);
            document.title = "emfont - 免費中文字體 Webfont 服務";
            break;
        case "fonts":
            if (urlParts.length > 2 && urlParts[2].length > 0) {
                document.querySelector("main").classList = "fonts-toFont";
                document.querySelector("main").classList.add("font");
                setTimeout(() => {
                    document.querySelector("main").classList.remove("fonts-toFont");
                }, 300);
                loadFontInfo(urlParts[2]);
            } else {
                document.querySelector("main").classList = "fonts";
                addClassToVisibleElements();
                document.title = "字體 - emfont";
            }
            if (fontList) {
                paramFromUrl();
                updateFontDisplay(null, true);
            }
            break;
        default:
            if (mainClass == "notFound") {
                document.title = "找不到頁面 - emfont";
            } else if (mainClass == "login") {
                document.title = "登入 - emfont";
            } else if (mainClass == "about") {
                document.title = "關於 - emfont";
            } else {
                document.title = `${mainClass} - emfont`;
            }
            document.querySelector("main").classList = mainClass;
            break;
    }
};
updateMain();

// listen when press back button and forward button
window.addEventListener("popstate", () => {
    updateMain();
});
