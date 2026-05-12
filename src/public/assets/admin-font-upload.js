const form = document.getElementById("font-upload-form");
const statusEl = document.getElementById("upload-status");
const logoutButton = document.getElementById("admin-logout");
const i18n = (key, values) =>
	typeof window.t === "function" ? window.t(key, values) : key;

function setStatus(message, className = "") {
	statusEl.textContent = message;
	statusEl.className = className;
}

function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(",")[1]);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

async function pollJob(jobId, token) {
	while (true) {
		const res = await fetch(`/api/admin/font-upload-jobs/${jobId}`);
		if (res.status === 401) window.location.href = "/admin/login";
		const data = await res.json();
		setStatus(data.message || data.status, data.status);
		if (data.status === "completed" || data.status === "failed") return data;
		await new Promise(resolve => setTimeout(resolve, 1800));
	}
}

form.addEventListener("submit", async event => {
	event.preventDefault();
	const submit = form.querySelector("button[type=submit]");
	submit.disabled = true;
	setStatus(i18n("admin.js.readFontFile"));

	try {
		const formData = new FormData(form);
		const file = formData.get("fontFile");
		const extension = file.name.split(".").pop().toLowerCase();
		const payload = Object.fromEntries(formData.entries());
		delete payload.fontFile;
		payload.extension = extension;
		payload.fileBase64 = await fileToBase64(file);

		setStatus(i18n("admin.generic.uploading"));
		const res = await fetch("/api/admin/fonts", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(payload),
		});
		if (res.status === 401) window.location.href = "/admin/login";
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || "Upload failed");
		setStatus(i18n("admin.js.uploadedQueue"));
		const job = await pollJob(data.jobId);
		if (job.status === "completed") {
			alert(
				i18n("admin.js.uploadDone", { fontUrl: job.fontUrl || data.fontUrl }),
			);
		}
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

window.i18nReady?.then(() => {
	document.title = i18n("admin.uploadTitle");
});

logoutButton.addEventListener("click", async () => {
	await fetch("/api/admin/logout", { method: "POST" });
	window.location.href = "/admin/login";
});
