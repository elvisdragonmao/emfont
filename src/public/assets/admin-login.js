const form = document.getElementById("admin-login-form");
const statusEl = document.getElementById("login-status");
const i18n = (key, values) =>
	typeof window.t === "function" ? window.t(key, values) : key;

function setStatus(message, className = "") {
	statusEl.textContent = message;
	statusEl.className = className;
}

form.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = form.querySelector("button[type=submit]");
	submit.disabled = true;
	setStatus(i18n("admin.generic.loginProgress"));
	try {
		const payload = Object.fromEntries(new FormData(form).entries());
		const res = await fetch("/api/admin/login", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Login failed");
		setStatus(i18n("admin.generic.loginSuccess"), "completed");
		window.location.href =
			data.user?.role === "super_admin" ? "/admin/fonts" : "/admin/fonts/edit";
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

window.i18nReady?.then(() => {
	document.title = i18n("admin.loginTitle");
});
