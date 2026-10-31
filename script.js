const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const navLinks = [...document.querySelectorAll(".site-nav a")];

menuToggle.addEventListener("click", () => {
	const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
	menuToggle.setAttribute("aria-expanded", String(!isOpen));
	menuToggle.setAttribute("aria-label", isOpen ? "開啟導覽選單" : "關閉導覽選單");
	siteNav.classList.toggle("is-open", !isOpen);
	document.body.classList.toggle("menu-open", !isOpen);
});

navLinks.forEach((link) => {
	link.addEventListener("click", () => {
		menuToggle.setAttribute("aria-expanded", "false");
		menuToggle.setAttribute("aria-label", "開啟導覽選單");
		siteNav.classList.remove("is-open");
		document.body.classList.remove("menu-open");
	});
});

const revealObserver = new IntersectionObserver((entries, observer) => {
	entries.forEach((entry) => {
		if (entry.isIntersecting) {
			entry.target.classList.add("is-visible");
			observer.unobserve(entry.target);
		}
	});
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((section) => revealObserver.observe(section));

const sectionObserver = new IntersectionObserver((entries) => {
	entries.forEach((entry) => {
		if (entry.isIntersecting) {
			navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${entry.target.id}`));
		}
	});
}, { rootMargin: "-30% 0px -60% 0px" });

document.querySelectorAll("main > section[id]").forEach((section) => sectionObserver.observe(section));

const countdown = document.querySelector(".tour-countdown");
if (countdown) {
	const countdownDate = countdown.dataset.countdownDate.split("-").map(Number);
	const targetDay = Date.UTC(countdownDate[0], countdownDate[1] - 1, countdownDate[2]);
	const countdownDays = countdown.querySelector("[data-countdown-days]");
	const countdownLabel = countdown.querySelector("[data-countdown-label]");
	const countdownAfter = countdown.querySelector("[data-countdown-after]");
	const taipeiDate = new Intl.DateTimeFormat("en-US", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "numeric",
		day: "numeric"
	});

	function updateCountdown() {
		const parts = Object.fromEntries(taipeiDate.formatToParts(new Date()).map((part) => [part.type, part.value]));
		const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
		const daysRemaining = Math.ceil((targetDay - today) / 86400000);
		const hasStarted = daysRemaining < 0;
		countdownDays.textContent = String(Math.max(daysRemaining, 0));
		countdownDays.parentElement.hidden = hasStarted;
		countdownAfter.hidden = !hasStarted;
		countdownLabel.textContent = daysRemaining === 0 ? "今天，台北首場登場" : "距離台北首場還有";
	}

	updateCountdown();
	window.setInterval(updateCountdown, 60000);
}

const player = document.querySelector(".player");
const playButton = document.querySelector(".play-button");
const seekSlider = document.querySelector(".seek-slider");
const volumeSlider = document.querySelector(".volume-slider");
const currentTimeLabel = document.querySelector(".time-current");
const playStatus = document.querySelector(".play-status");
const trackLength = 60;
const beatLength = 0.48;
const melody = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23, 440, 587.33, 440, 349.23, 246.94, 311.13, 369.99, 493.88];
let audioContext;
let masterGain;
let playing = false;
let elapsed = 0;
let startedAt = 0;
let playbackTimer;
let scheduledBeat = -1;

function formatTime(seconds) {
	const safeSeconds = Math.floor(seconds);
	return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function updateSliderFill(slider, progress) {
	slider.style.background = `linear-gradient(to right, var(--cyan) 0%, var(--cyan) ${progress}%, rgba(255,255,255,.2) ${progress}%, rgba(255,255,255,.2) 100%)`;
}

function playTone(frequency, start, duration, type, volume) {
	const oscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, start);
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
	oscillator.connect(gain);
	gain.connect(masterGain);
	oscillator.start(start);
	oscillator.stop(start + duration + 0.04);
}

function scheduleBeat(beat) {
	if (beat === scheduledBeat) return;
	scheduledBeat = beat;
	const now = audioContext.currentTime;
	const note = melody[beat % melody.length];
	playTone(note, now, 0.36, "triangle", 0.12);
	if (beat % 4 === 0) {
		playTone(note / 2, now, 0.42, "sine", 0.17);
		playTone(82, now, 0.12, "sine", 0.06);
	} else if (beat % 2 === 0) {
		playTone(note * 1.5, now, 0.2, "sine", 0.035);
	}
}

function updatePlayback() {
	if (!playing) return;
	elapsed = Math.min(trackLength, (performance.now() - startedAt) / 1000);
	const progress = (elapsed / trackLength) * 100;
	seekSlider.value = String(Math.floor(elapsed));
	currentTimeLabel.textContent = formatTime(elapsed);
	updateSliderFill(seekSlider, progress);
	const currentBeat = Math.floor(elapsed / beatLength);
	if (currentBeat !== scheduledBeat) scheduleBeat(currentBeat);
	if (elapsed >= trackLength) stopPlayback();
}

async function startPlayback() {
	const AudioContext = window.AudioContext || window.webkitAudioContext;
	if (!AudioContext) {
		playStatus.textContent = "此瀏覽器不支援音訊播放";
		return;
	}
	audioContext ??= new AudioContext();
	if (audioContext.state === "suspended") await audioContext.resume();
	masterGain ??= audioContext.createGain();
	masterGain.connect(audioContext.destination);
	masterGain.gain.setTargetAtTime(Number(volumeSlider.value) / 100 * 0.42, audioContext.currentTime, 0.04);
	if (elapsed >= trackLength) elapsed = 0;
	scheduledBeat = -1;
	startedAt = performance.now() - elapsed * 1000;
	playing = true;
	player.classList.add("is-playing");
	playButton.setAttribute("aria-pressed", "true");
	playButton.setAttribute("aria-label", "暫停新曲");
	playStatus.textContent = "播放中・夜色持續前進";
	updatePlayback();
	playbackTimer = window.setInterval(updatePlayback, 100);
}

function stopPlayback() {
	if (playing) elapsed = Math.min(trackLength, (performance.now() - startedAt) / 1000);
	playing = false;
	window.clearInterval(playbackTimer);
	player.classList.remove("is-playing");
	playButton.setAttribute("aria-pressed", "false");
	playButton.setAttribute("aria-label", "播放新曲");
	playStatus.textContent = elapsed >= trackLength ? "試聽結束・再次播放" : "已暫停・從此刻繼續";
}

playButton.addEventListener("click", () => {
	if (playing) stopPlayback();
	else startPlayback();
});

seekSlider.addEventListener("input", () => {
	elapsed = Number(seekSlider.value);
	currentTimeLabel.textContent = formatTime(elapsed);
	updateSliderFill(seekSlider, (elapsed / trackLength) * 100);
	scheduledBeat = -1;
	if (playing) startedAt = performance.now() - elapsed * 1000;
});

volumeSlider.addEventListener("input", () => {
	if (masterGain && audioContext) {
		masterGain.gain.setTargetAtTime(Number(volumeSlider.value) / 100 * 0.42, audioContext.currentTime, 0.04);
	}
});

updateSliderFill(seekSlider, 0);