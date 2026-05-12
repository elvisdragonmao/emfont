(function () {
	const defaultLocale = "zh-Hant";
	const htmlLocale = document.documentElement.lang || defaultLocale;
	const params = new URLSearchParams(window.location.search);
	const queryLocale = params.get("lang");
	const cookieLocale = document.cookie
		.split("; ")
		.find(cookie => cookie.startsWith("emfont_locale="))
		?.split("=")[1];
	const locale =
		queryLocale ||
		localStorage.getItem("emfont-locale") ||
		(cookieLocale ? decodeURIComponent(cookieLocale) : "") ||
		htmlLocale ||
		navigator.language ||
		defaultLocale;

	if (queryLocale) {
		localStorage.setItem("emfont-locale", queryLocale);
		document.cookie = `emfont_locale=${encodeURIComponent(queryLocale)}; path=/; max-age=31536000; samesite=lax`;
	}

	function resolve(messages, key) {
		return key.split(".").reduce((value, segment) => {
			if (!value || !Object.prototype.hasOwnProperty.call(value, segment)) {
				return undefined;
			}
			return value[segment];
		}, messages);
	}

	function interpolate(message, values = {}) {
		return String(message).replace(/\{([^{}]+)\}/g, (_, key) => {
			return values[key] ?? "";
		});
	}

	function applyTranslations(messages) {
		document.querySelectorAll("[data-i18n]").forEach(element => {
			element.textContent = window.t(element.dataset.i18n);
		});
		document.querySelectorAll("[data-i18n-html]").forEach(element => {
			element.innerHTML = window.t(element.dataset.i18nHtml);
		});
		document.querySelectorAll("[data-i18n-attrs]").forEach(element => {
			element.dataset.i18nAttrs.split(",").forEach(entry => {
				const [attr, key] = entry.split(":").map(value => value.trim());
				if (attr && key) element.setAttribute(attr, window.t(key));
			});
		});
		document.documentElement.lang = locale;
		return messages;
	}

	window.emfontLocale = locale;
	window.t = (key, values) => interpolate(key, values);
	window.i18nReady = fetch(`/assets/locales/${locale}.json`)
		.then(response => {
			if (!response.ok && locale !== defaultLocale) {
				return fetch(`/assets/locales/${defaultLocale}.json`);
			}
			return response;
		})
		.then(response => response.json())
		.then(messages => {
			window.emfontMessages = messages;
			window.t = (key, values) => {
				const message = resolve(messages, key);
				return interpolate(message ?? key, values);
			};
			return applyTranslations(messages);
		})
		.catch(error => {
			console.error("Failed to load locale:", error);
			window.emfontMessages = {};
			return {};
		});
})();
