const form = document.getElementById("font-upload-form");
const statusEl = document.getElementById("upload-status");
const logoutButton = document.getElementById("admin-logout");

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
	setStatus("正在讀取字型檔");

	try {
		const formData = new FormData(form);
		const file = formData.get("fontFile");
		const extension = file.name.split(".").pop().toLowerCase();
		const payload = Object.fromEntries(formData.entries());
		delete payload.fontFile;
		payload.extension = extension;
		payload.fileBase64 = await fileToBase64(file);

		setStatus("正在上傳");
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
		setStatus("已上傳，正在排程切割");
		const job = await pollJob(data.jobId);
		if (job.status === "completed") {
			alert(`字型上傳完成\n${job.fontUrl || data.fontUrl}`);
		}
	} catch (error) {
		setStatus(error.message, "failed");
	} finally {
		submit.disabled = false;
	}
});

logoutButton.addEventListener("click", async () => {
	await fetch("/api/admin/logout", { method: "POST" });
	window.location.href = "/admin/login";
});
