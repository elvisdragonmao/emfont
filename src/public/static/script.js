emfont.init({
    colorTest: true
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
    if (!href.startsWith("/")) return;
    if (href.startsWith("/docs")) return;

    event.preventDefault();
    updateMain(href);
    history.pushState({}, "", href);
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

let fontList = {};
const families = new Set();
const tags = new Set();
const categories = new Set();

const updateFontDisplay = (e, animationOff = false) => {
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

    const filtered = fontList.filter(font => {
        const matchFamily = family === "all" || font.family === family;
        const matchCategory = categories.length === 0 || categories.includes(font.category);
        const matchTags = tags.length === 0 || tags.every(tag => font.tags.includes(tag));
        return matchFamily && matchCategory && matchTags;
    });

    // 你可以改成要放的地方
    const container = document.getElementById("section-search");
    container.innerHTML = "";
    const searchTest = document.querySelector("#search-test");
    const previewText = searchTest.value || "我個人認為義大利麵就應該拌42號混泥土，因為這個螺絲釘的長度很容易直接影響到挖掘機的扭矩。";
    let containerHTML = "";
    filtered.forEach(font => {
        const parts = [];
        for (let weight in font.weight) {
            if (weightChart[weight]) {
                parts.push(`<span class="l">${weightChart[weight][0]}</span>`);
            } else parts.push(`<span class="l">${weight}</span>`);
        }
        weightStr = parts.join(" ⋅ ");
        containerHTML += `<a class="font-item" href="/fonts/${encodeURIComponent(font.id)}" ${animationOff ? "style=animation:none" : ""}>
                    <div class="font-title">
                        <h3>${font.name}</h3>
                        <div class="weight">
                            ${weightStr}&nbsp; | &nbsp;by ${font.author}
                        </div>
                    </div>
                    <div class="font-preview" data-class="emfont-${font.id}">${previewText}</div>
                </a>
            `;
    });
    container.innerHTML = containerHTML;
    addClassToVisibleElements();
    if (container.innerHTML == "") {
        container.innerHTML = `<div class="no-result"><div class="╯°□°╯">(╯°□°)╯︵ ┻┻</div>你要求太多了吧！<br>沒找到想要的字體嗎？歡迎到 <a href=https://github.com/emfont/emfont/issues/new/choose>GitHub</a> 推薦給我們！</div>`;
    }
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

    updateFontDisplay();
    document.querySelectorAll(".search-container input, .search-container select").forEach(input => {
        input.addEventListener("change", updateFontDisplay);
    });

    const searchText = document.getElementById("search-test");
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
    var aosElements = document.querySelectorAll(".font-preview");
    aosElements.forEach(function (aosElement) {
        const className = aosElement.getAttribute("data-class");
        if (!isElementInViewport(aosElement)) aosElement.classList.add(className);
        else aosElement.classList.remove(className);
    });
    emfont.init();
}

document.addEventListener("scroll", addClassToVisibleElements);
addClassToVisibleElements();

const loadFontInfo = async fontId => {
    const res = await fetch(`/info/${fontId}`);
    const font = await res.json();
    if (font == { status: "failed", message: "Font not found" }) {
        document.querySelector("main").classList = "notFound";
        return;
    }
    const container = document.querySelector(".info-container.fontPage-container");
    container.innerHTML = `
    <a class="navigation" href="/fonts"> <img src="/static/img/larr.svg" alt="">字型 </a>
    <h1>${font.name.original}</h1>
    <p>${font.name.zh}</p>
    <div class="font-tags">
        ${font.tag.map(tag => `<a class="tag"  href="/fonts?q=${tag}">${tag}</a>`).join("")}
    </div>
    <div class="font-actions">
        <div class="font-class">
            <div>emfont-${fontId}</div>
            <div id="copyClass"></div>
        </div>
        <a href="${font.source}" target="_blank">
            <img src="/static/img/GitHub-400.svg" alt="GitHub">
        </a>
        <a href="${font.source}" target="_blank">
            <img src="/static/img/download.svg" alt="GitHub">
        </a>
    </div>
    <p class="font-description">${font.description}</p>
    <p class="font-info">
        字型家族：<a href="/fonts?q=${font.family}">${font.family}</a><br>
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
    const inputText = document.querySelector("#search-test").value || "我個人認為義大利麵就應該拌42號混泥土，因為這個螺絲釘的長度很容易直接影響到挖掘機的扭矩。";
    //font.weight.push(400);
    let weightHTML = font.weight
        .map(
            weight =>
                `<div class="font-item">
            <div class="font-title"><div class="weight">${weightChart[weight][1]} ${weight}</div></div>
            <div class="font-preview emfont-${fontId}-${weight}">${inputText}</div></div>`
        )
        .join("");
    document.querySelector(".font-weights").innerHTML = weightHTML || `<div class="no-result"><div class="╯°□°╯">¯\_(ツ)_/¯</div>這個字體暫時無法使用。</div>`;
    emfont.init();
    container.querySelector(".font-class").onclick = e => {
        navigator.clipboard.writeText(e.target.innerText).then(() => {
            container.querySelector(".font-class").style.setProperty("--background", "rgb(59, 88, 49)");
            setTimeout(() => {
                container.querySelector(".font-class").style.setProperty("--background", " var(--slate-700)");
            }, 2000);
        });
    };
    addClassToVisibleElements();
};

const updateMain = (path = window.location.pathname) => {
    const urlParts = path.split("?")[0].split("/");
    let mainClass = urlParts[1].replace("index.html", "") || "";
    if (mainClass == "") mainClass = "home";
    if (!pages.includes(mainClass)) mainClass = "notFound";
    mobileToggle.checked = mainClass == "fonts";
    document.querySelector(".info-container.fontPage-container").innerHTML = "";

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
            }
            const urlParams = new URLSearchParams(window.location.search);
            document.getElementById("search-input").value = urlParams.get("q");
            break;
        default:
            document.querySelector("main").classList = mainClass;
            break;
    }
};
updateMain();

// listen when press back button and forward button
window.addEventListener("popstate", () => {
    updateMain();
});
