/** @format */

window.onload = () => {
    document.querySelector(".fader").classList.add("fade-in");
};

document.addEventListener("DOMContentLoaded", () => {
    // get scroll position from session
    if (
        getComputedStyle(document.querySelector(":root")).getPropertyValue(
            "--dashboard"
        )
    ) {
        const scroll = sessionStorage.getItem("scroll");
        if (scroll) {
            window.scrollTo(0, scroll);
            sessionStorage.removeItem("scroll");
        }
    }

    const aElements = document.querySelectorAll("a");
    aElements.forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            const href = link.getAttribute("href");
            document.querySelector(".fader").classList.add("fade-out");
            setTimeout(() => {
                // if new tab
                if (link.getAttribute("target") === "_blank")
                    window.open(href, "_blank");
                else {
                    if (
                        getComputedStyle(
                            document.querySelector(":root")
                        ).getPropertyValue("--dashboard")
                    )
                        sessionStorage.setItem("scroll", window.scrollY);
                    window.location.href = href;
                }
            }, 100);
        });
    });
});
