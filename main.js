const PAGE_SIZE = 8;
const FETCH_SIZE = 50;
const RECENT_KEY = "lyrics-search-recent";

const userInput = document.querySelector("#user-input");
const searchForm = document.querySelector("#search-form");
const searchGo = document.querySelector(".search-go");
const searchResult = document.querySelector("#search-result");
const resultsSection = document.querySelector("#results");
const resultsCount = document.querySelector("#results-count");
const lyricView = document.querySelector("#lyric-view");
const toastEl = document.querySelector(".toast");
const nextButton = document.querySelector("#next");
const prevButton = document.querySelector("#prev");
const recentEl = document.querySelector("#recent");
const homeLink = document.querySelector("#home-link");

const state = {
  query: "",
  offset: 0,
  catalog: [],
  items: [],
  hasMore: false,
};

let abortSearch = null;
let toastTimer = 0;

const escapeHTML = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toHttps = (url = "") => url.replace(/^http:\/\//i, "https://");

const formatTime = (ms = 0) => {
  const total = Math.round(Number(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const enlargeArtwork = (url = "") =>
  toHttps(url).replace("100x100bb", "600x600bb").replace("100x100", "600x600");

const showToast = (msg) => {
  toastEl.textContent = msg;
  toastEl.classList.add("is-on");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("is-on"), 4200);
};

const setMode = (mode) => {
  document.body.classList.toggle("is-browsing", mode === "results");
  document.body.classList.toggle("is-lyrics", mode === "lyrics");
  resultsSection.hidden = mode !== "results";
  lyricView.hidden = mode !== "lyrics";
};

const loadRecent = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const saveRecent = (query) => {
  const next = [query, ...loadRecent().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  renderRecent();
};

const renderRecent = () => {
  const items = loadRecent();
  if (!items.length) {
    recentEl.hidden = true;
    recentEl.innerHTML = "";
    return;
  }
  recentEl.hidden = false;
  recentEl.innerHTML = items
    .map((item) => `<button type="button" class="chip" data-q="${escapeHTML(item)}">${escapeHTML(item)}</button>`)
    .join("");
};

const mapItunes = (track) => ({
  artist: track.artistName || "Unknown artist",
  title: track.trackName || "Untitled",
  album: track.collectionName || "",
  cover: enlargeArtwork(track.artworkUrl100 || ""),
  preview: track.previewUrl || "",
  duration: formatTime(track.trackTimeMillis),
});

const mapDeezer = (track) => ({
  artist: track.artist?.name || "Unknown artist",
  title: track.title || "Untitled",
  album: track.album?.title || "",
  cover: toHttps(track.album?.cover_medium || track.album?.cover || ""),
  preview: toHttps(track.preview || ""),
  duration: formatTime((track.duration || 0) * 1000),
});

const dedupeTracks = (tracks) => {
  const seen = new Set();
  return tracks.filter((track) => {
    const key = `${track.artist}|${track.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const searchItunes = async (query, signal) => {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${FETCH_SIZE}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("iTunes search failed");
  const data = await response.json();
  return dedupeTracks((data.results || []).map(mapItunes));
};

const searchLyricsOvh = async (query, signal) => {
  const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Suggest search failed");
  const data = await response.json();
  return dedupeTracks((data.data || []).map(mapDeezer));
};

const runSearch = async (query) => {
  if (abortSearch) abortSearch.abort();
  abortSearch = new AbortController();
  const { signal } = abortSearch;

  try {
    return await searchItunes(query, signal);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return searchLyricsOvh(query, signal);
  }
};

const pageFromCatalog = (offset) => {
  const items = state.catalog.slice(offset, offset + PAGE_SIZE);
  return {
    items,
    hasMore: offset + PAGE_SIZE < state.catalog.length,
    query: state.query,
    offset,
  };
};

const pauseOthers = (current) => {
  document.querySelectorAll("audio").forEach((audio) => {
    if (audio !== current) audio.pause();
  });
};

const bindAudio = (root) => {
  root.querySelectorAll("audio").forEach((audio) => {
    const card = audio.closest(".sleeve, .lyric-view");
    audio.addEventListener("play", () => {
      pauseOthers(audio);
      card?.classList.add("is-playing");
    });
    audio.addEventListener("pause", () => card?.classList.remove("is-playing"));
    audio.addEventListener("ended", () => card?.classList.remove("is-playing"));
  });
};

const renderSkeletons = () => {
  setMode("results");
  resultsCount.textContent = "Listening for a match…";
  searchResult.innerHTML = Array.from({ length: 4 }, () => `<div class="skeleton"></div>`).join("");
  nextButton.hidden = true;
  prevButton.hidden = true;
};

const renderEmpty = (title, copy) => {
  setMode("results");
  resultsCount.textContent = "";
  searchResult.innerHTML = `
    <div class="empty" style="grid-column: 1 / -1">
      <img src="images/vinyl-float.jpg" alt="">
      <h2>${escapeHTML(title)}</h2>
      <p>${escapeHTML(copy)}</p>
    </div>
  `;
  nextButton.hidden = true;
  prevButton.hidden = true;
};

const renderResults = (payload) => {
  const { items, hasMore, query, offset } = payload;
  state.items = items;
  state.hasMore = hasMore;
  state.query = query;
  state.offset = offset;

  if (!items.length) {
    renderEmpty("Nothing on the setlist", "Try another title, or just a mood. The booth is listening.");
    return;
  }

  setMode("results");
  const from = offset + 1;
  const to = offset + items.length;
  resultsCount.textContent = `Tracks ${from}–${to}`;

  searchResult.innerHTML = items
    .map((track, index) => `
      <article class="sleeve" style="--delay: ${index * 70}ms">
        <div class="sleeve-art">
          <div class="vinyl" aria-hidden="true"></div>
          <img src="${escapeHTML(track.cover)}" alt="${escapeHTML(track.album || track.title)} cover">
        </div>
        <div class="sleeve-body">
          <p class="sleeve-artist">${escapeHTML(track.artist)}</p>
          <h2 class="sleeve-title">${escapeHTML(track.title)}</h2>
          <p class="sleeve-meta">${escapeHTML([track.album, track.duration].filter(Boolean).join(" · "))}</p>
          ${track.preview ? `<audio class="hidden-audio" preload="none" src="${escapeHTML(track.preview)}"></audio>` : ""}
          <div class="sleeve-actions">
            ${track.preview ? `<button type="button" class="btn-ghost" data-action="preview">Preview</button>` : ""}
            <button
              type="button"
              class="btn-solid get-lyrics"
              data-action="lyrics"
              data-artist="${escapeHTML(track.artist)}"
              data-title="${escapeHTML(track.title)}"
              data-cover="${escapeHTML(track.cover)}"
              data-preview="${escapeHTML(track.preview)}"
            >Get lyrics</button>
          </div>
        </div>
      </article>
    `)
    .join("");

  bindAudio(searchResult);
  prevButton.hidden = offset <= 0;
  nextButton.hidden = !hasMore;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

const cleanLyrics = (text) =>
  text
    .replace(/^paroles de la chanson .* par .*\s*/i, "")
    .replace(/\r\n|\r/g, "\n")
    .trim();

const fetchLyricsOvh = async (artist, title) => {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("ovh");
  const data = await response.json();
  if (!data.lyrics) throw new Error("ovh empty");
  return cleanLyrics(data.lyrics);
};

const fetchLrclib = async (artist, title) => {
  const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("lrclib");
  const data = await response.json();
  if (data.instrumental) return { instrumental: true, lyrics: "" };
  if (!data.plainLyrics) throw new Error("lrclib empty");
  return { instrumental: false, lyrics: data.plainLyrics };
};

const fetchLyrics = async (artist, title) => {
  try {
    const lyrics = await fetchLyricsOvh(artist, title);
    return { instrumental: false, lyrics };
  } catch {
    return fetchLrclib(artist, title);
  }
};

const showLyricsShell = ({ artist, title, cover, preview }) => {
  setMode("lyrics");
  lyricView.classList.remove("is-playing");
  lyricView.innerHTML = `
    <button type="button" class="icon-btn lyric-back" data-action="back">← Back to setlist</button>
    <div class="lyric-layout">
      <aside class="lyric-side">
        <div class="cover-stage">
          <div class="vinyl-lg" aria-hidden="true"></div>
          <img src="${escapeHTML(cover)}" alt="${escapeHTML(title)} cover">
        </div>
        <h2>${escapeHTML(title)}</h2>
        <p class="artist">${escapeHTML(artist)}</p>
        ${preview ? `<audio controls preload="none" src="${escapeHTML(preview)}"></audio>` : ""}
        <button type="button" class="icon-btn" data-action="copy" hidden>Copy lyrics</button>
      </aside>
      <article class="lyric-sheet loading">
        <p>Finding the words…</p>
      </article>
    </div>
  `;
  bindAudio(lyricView);
};

const fillLyrics = (payload) => {
  const sheet = lyricView.querySelector(".lyric-sheet");
  const copyBtn = lyricView.querySelector('[data-action="copy"]');
  if (!sheet) return;

  if (payload.instrumental) {
    sheet.className = "lyric-sheet empty-sheet";
    sheet.innerHTML = "<p>This one’s instrumental. Let the vinyl speak.</p>";
    return;
  }

  sheet.className = "lyric-sheet";
  sheet.innerHTML = `<div class="sheet-inner">${escapeHTML(payload.lyrics)}</div>`;
  if (copyBtn) {
    copyBtn.hidden = false;
    copyBtn.dataset.text = payload.lyrics;
  }
};

const showLyricsError = () => {
  const sheet = lyricView.querySelector(".lyric-sheet");
  if (!sheet) return;
  sheet.className = "lyric-sheet empty-sheet";
  sheet.innerHTML = "<p>Lyrics went quiet. Try another cut from the setlist.</p>";
};

const restoreResults = () => {
  if (!state.catalog.length) {
    goHome();
    return;
  }
  renderResults(pageFromCatalog(state.offset));
};

const handleSearch = async (rawQuery, offset = 0) => {
  let query = rawQuery.trim();
  if (!query) {
    query = "without lyrics";
    showToast("Without lyrics? Bold. Here's the instrumental aisle.");
  }

  userInput.value = rawQuery.trim() ? query : rawQuery;

  searchGo.classList.add("is-loading");
  lyricView.hidden = true;

  try {
    if (offset === 0 || query !== state.query || !state.catalog.length) {
      renderSkeletons();
      state.query = query;
      state.catalog = await runSearch(query);
    }
    renderResults(pageFromCatalog(offset));
    if (rawQuery.trim() && state.catalog.length) saveRecent(rawQuery.trim());
  } catch (error) {
    if (error.name === "AbortError") return;
    renderEmpty("The booth lost the signal", "The catalog blinked. Give it another try in a moment.");
    showToast("Search failed. Try again in a moment.");
  } finally {
    searchGo.classList.remove("is-loading");
  }
};

const goHome = () => {
  if (abortSearch) abortSearch.abort();
  document.querySelectorAll("audio").forEach((audio) => audio.pause());
  setMode("home");
  resultsSection.hidden = true;
  lyricView.hidden = true;
  document.body.classList.remove("is-browsing", "is-lyrics");
  searchResult.innerHTML = "";
  userInput.focus();
};

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSearch(userInput.value, 0);
});

recentEl.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-q]");
  if (!chip) return;
  userInput.value = chip.dataset.q;
  handleSearch(chip.dataset.q, 0);
});

searchResult.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.action === "preview") {
    const audio = button.closest(".sleeve")?.querySelector("audio");
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
    return;
  }

  if (button.dataset.action !== "lyrics") return;

  const { artist, title, cover, preview } = button.dataset;
  showLyricsShell({ artist, title, cover, preview });

  try {
    const payload = await fetchLyrics(artist, title);
    fillLyrics(payload);
  } catch {
    showLyricsError();
    showToast("Lyrics do not exist for this one. Try another cut.");
  }
});

lyricView.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.action === "back") {
    document.querySelectorAll("audio").forEach((audio) => audio.pause());
    restoreResults();
    return;
  }

  if (button.dataset.action === "copy") {
    try {
      await navigator.clipboard.writeText(button.dataset.text || "");
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy lyrics";
      }, 1600);
    } catch {
      showToast("Could not copy. Select the words instead.");
    }
  }
});

nextButton.addEventListener("click", () => {
  handleSearch(state.query, state.offset + PAGE_SIZE);
});

prevButton.addEventListener("click", () => {
  handleSearch(state.query, Math.max(0, state.offset - PAGE_SIZE));
});

homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  goHome();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== userInput && event.target.tagName !== "INPUT") {
    event.preventDefault();
    userInput.focus();
    userInput.select();
  }
  if (event.key === "Escape" && !lyricView.hidden) {
    restoreResults();
  }
});

window.addEventListener("pointermove", (event) => {
  document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
  document.documentElement.style.setProperty("--my", `${event.clientY}px`);
});

const stageVideo = document.querySelector("#background-video");
stageVideo?.play?.().catch(() => {});

renderRecent();
userInput.focus();
