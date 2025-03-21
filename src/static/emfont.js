const emfont = (function () {
    // Function to get all elements with class starting with .emfont and load the custom font
    const loadCustomFonts = (config = {
        
    }, callback) => {
    }
        const elements = document.querySelectorAll("[class*='emfont']");
        let fonts = {};
        let promises = [];
        elements.forEach(element => {
            // Get all font names from element class
            const fontNames = element.className
                .split(" ")
                .filter(name => name.startsWith("emfont-"))
                .map(name => name.replace("emfont-", ""));
            const words = element.textContent.trim(); // Custom words from element text

            fontNames.forEach(fontName => {
                if (fontName && words)
                    fonts[fontName] =
                        (fonts[fontName] ? fonts[fontName] : "") + words;
            });
        });
        const cssElement = document.createElement("style");

        // Load custom fonts
        for (const fontName in fonts) {
            var textList = fonts[fontName];
            // Remove duplicate characters and sort by UTF encoding
            textList = Array.from(new Set(textList.split("")))
                .sort()
                .join("");
            let promise = fetch("https://font.emtech.cc/g/" + fontName, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ words: textList }),
            })
                .then(response => response.json())
                .then(data => {
                    const fontCSSName = data.font.zh;
                    const font = new FontFace(fontCSSName, `url(${data.url})`);
                    cssElement.innerHTML += `.emfont-${fontName} { font-family: '${fontCSSName}', sans-serif; }`;
                    // Add to the document.fonts (FontFaceSet)
                    return font.load().then(loadedFont => {
                        document.fonts.add(loadedFont);
                    });
                });
            promises.push(promise);
        }
        document.head.appendChild(cssElement);

        // Wait for all fonts to load
        Promise.all(promises).then(() => {
            if (callback && typeof callback === "function") {
                callback();
            }
        });
    }

    return {
        init: (config, callback) => {
            loadCustomFonts(config, callback);
        },
    };
})();
/* eslint-enable no-unused-vars */
