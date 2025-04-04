const marqueeSet = () => {
    const marquees = document.querySelectorAll("#section-home > div");
    for (const marquee of marquees) {
        const inner = marquee.querySelector("span");
        const marqueeWidth = inner.getBoundingClientRect().width;
        marquee.style = `--innerWidth: ${-marqueeWidth}px;`;
        marquee.innerHTML =
            "<span>" +
            inner.innerText +
            "</span>" +
            inner.innerText.repeat(Math.ceil(window.outerWidth / marqueeWidth));
    }
};

window.addEventListener("resize", () => {
    if (document.querySelector("main").classList.contains("home")) marqueeSet();
});

const pages = [
    "home",
    "about",
    "font",
    "fonts",
    "login",
    "logout",
    "dashboard"
];
const mobileToggle = document.getElementById("mobileToggle");

const updateMain = (path = window.location.pathname) => {
    const urlParts = path.split("/");
    let mainClass = urlParts[1].replace("index.html", "") || "";
    if (mainClass == "") mainClass = "home";
    if (!pages.includes(mainClass)) mainClass = "notFound";
    if (mainClass == "home" && window.location.pathname == "/fonts") {
        document.querySelector("main").classList.add("fonts-toHome");
        setTimeout(() => {
            document.querySelector("main").classList = "home";
            marqueeSet();
        }, 300);
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (
            mainClass == "fonts" &&
            urlParts.length > 2 &&
            urlParts[2].length > 0
        ) {
            document.querySelector("main").classList = "fonts-toFont";
            document.querySelector("main").classList.add("font");
            setTimeout(() => {
                document.querySelector("main").classList.remove("fonts-toFont");
            }, 300);
        } else document.querySelector("main").classList = mainClass;
        if (mainClass == "home") marqueeSet();
        if (mainClass == "fonts"){
            document.getElementById("search-input").value = urlParams.get("q");
            mobileToggle.checked = true;
        } else   mobileToggle.checked = false;
    }
};

updateMain();

document.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (href.startsWith("/")) {
            if (href.startsWith("/docs")) return;
            event.preventDefault();
            updateMain(href);
            history.pushState({}, "", href);
        }
    });
});
