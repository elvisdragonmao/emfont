//emfont.init();
const marqueeSet = () => {
    const marquees = document.querySelectorAll("#section-home > div");
    for (const marquee of marquees) {
        const inner = marquee.querySelector("span");
        const marqueeWidth = inner.getBoundingClientRect().width;
        marquee.style = `--innerWidth: ${-marqueeWidth}px;`;
        marquee.innerHTML = "<span>" + inner.innerText + "</span>" + inner.innerText.repeat(Math.ceil(window.outerWidth / marqueeWidth));
    }
};

window.addEventListener("resize", () => {
    if (document.querySelector("main").classList.contains("home")) marqueeSet();
});

const pages = ["home", "about", "font", "fonts", "login", "logout", "dashboard"];
const mobileToggle = document.getElementById("mobileToggle");

const updateMain = (path = window.location.pathname) => {
    const urlParts = path.split("/");
    let mainClass = urlParts[1].replace("index.html", "") || "";
    if (mainClass == "") mainClass = "home";
    if (!pages.includes(mainClass)) mainClass = "notFound";
    mobileToggle.checked = mainClass == "fonts";

    switch (mainClass) {
        case "home":
            let delay = 0;
            if (window.location.pathname == "/fonts") {
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

document.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", event => {
        const href = link.getAttribute("href");
        if (href.startsWith("/")) {
            if (href.startsWith("/docs")) return;
            event.preventDefault();
            updateMain(href);
            history.pushState({}, "", href);
        }
    });
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

// search

const searchInput = document.querySelector("#search-input");
const sectionSearch = document.querySelector("#section-search");
const searchTest = document.querySelector("#search-test");
// 範例展示字串
const previewText = searchTest.value || "我個人認為義大利麵就應該拌42號混泥土，因為這個螺絲釘的長度很容易直接影響到挖掘機的扭矩。";

// 輸出 font-item DOM 結構
function renderFontItem(font) {
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

    const parts = [];
    for (let weight in font.weight) {
        if (weights.includes(weight)) {
            parts.push(`<span class="l">${weightChart[weight][0]}</span>`);
        } else parts.push(`<span class="l">${weight}</span>`);
    }
    weightStr = parts.join(" ⋅ ");
    return `
        <a class="font-item" href="/fonts/${encodeURIComponent(font.id)}">
            <div class="font-title">
                <h3>${font.name}</h3>
                <div class="weight">
                    ${weightStr}&nbsp; | &nbsp;by ${font.author}
                </div>
            </div>
            <div class="font-preview">${previewText}</div>
        </a>
    `;
}

// 綁定 input 事件
searchInput.addEventListener("input", async e => {
    const query = e.target.value.trim();
    if (!query) {
        sectionSearch.innerHTML = ""; // 清空
        return;
    }

    try {
        const res = await fetch(`/list?q=${encodeURIComponent(query)}`);
        const fonts = await res.json();

        // 產生 HTML 並插入
        const html = fonts.map(renderFontItem).join("");
        sectionSearch.innerHTML = html;
    } catch (err) {
        console.error("搜尋失敗", err);
        sectionSearch.innerHTML = "<p>搜尋失敗，請稍後再試。</p>";
    }
});
