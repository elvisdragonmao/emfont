export {};

const form = document.getElementById("admin-login-form") as HTMLFormElement;
const statusEl = document.getElementById("login-status") as HTMLElement;
const apiBase = document.documentElement.dataset.apiBase?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => `${apiBase}${path}`;

function setStatus(message, className = "") {
	statusEl.textContent = message;
	statusEl.className = className;
}

form.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = form.querySelector("button[type=submit]") as HTMLButtonElement;
	submit.disabled = true;
	setStatus("正在登入");
	try {
		const payload = Object.fromEntries(new FormData(form).entries());
		const res = await fetch(apiUrl("/api/admin/login"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Login failed");
		setStatus("登入成功", "completed");
		window.location.href = "/admin/fonts";
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});
