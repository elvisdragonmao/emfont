const form = document.getElementById("admin-login-form");
const statusEl = document.getElementById("login-status");

function setStatus(message, className = "") {
	statusEl.textContent = message;
	statusEl.className = className;
}

form.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = form.querySelector("button[type=submit]");
	submit.disabled = true;
	setStatus("正在登入");
	try {
		const payload = Object.fromEntries(new FormData(form).entries());
		const res = await fetch("/api/admin/login", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
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
