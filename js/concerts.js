(async function () {
  const concertsRoot = document.getElementById("concerts-root");
  const albumsRoot = document.getElementById("albums-root");
  if (!concertsRoot) return;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  try {
    const DL = window.DataLayer;
    if (!DL || typeof DL.load !== "function") {
      throw new Error("DataLayer 未載入，請確認 js/data.js 路徑正確。");
    }
    await DL.load();
    Overlay.init({ syncUrl: false });

    const themes =
      typeof DL.themeConcerts === "function"
        ? DL.themeConcerts()
        : DL.funFacts().themeConcerts || [];

    if (!themes.length) {
      concertsRoot.innerHTML = `<p class="ff-empty">暫無主題演唱會／巡演資料。</p>`;
    } else {
      concertsRoot.innerHTML = `
      <p class="ff-lead">共 <strong>${themes.length}</strong> 個主題演唱會／巡演。</p>
      <ol class="ff-list concert-coverage-list">
        ${themes
          .map((row, i) => {
            const c = row.concert;
            const range =
              row.first_date && row.last_date
                ? row.first_date === row.last_date
                  ? row.first_date
                  : `${row.first_date} – ${row.last_date}`
                : "";
            const place = row.cities.length
              ? row.cities.join("、")
              : row.countries.join("、");
            return `<li>
              <span class="ff-rank">${i + 1}.</span>
              <div class="ff-item-body">
                <button type="button" class="ff-link ff-main" data-open-concert="${c.concert_id}">${DL.concertNameHTML(c)}</button>
                <div class="ff-sub">${row.session_count} 場${range ? ` · ${escapeHtml(range)}` : ""}${place ? ` · ${escapeHtml(place)}` : ""}</div>
              </div>
            </li>`;
          })
          .join("")}
      </ol>`;
    }

    concertsRoot.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-concert]");
      if (!btn) return;
      Overlay.openSetlist(btn.getAttribute("data-open-concert"), "", "", {
        push: false,
      });
    });

    if (albumsRoot) {
      const albums =
        typeof DL.catalogAlbums === "function" ? DL.catalogAlbums() : [];
      if (!albums.length) {
        albumsRoot.innerHTML = `<p class="ff-empty">暫無專輯資料。</p>`;
      } else {
        albumsRoot.innerHTML = `
      <p class="ff-lead">共 <strong>${albums.length}</strong> 張專輯／EP／單曲。</p>
      <ol class="ff-list concert-coverage-list">
        ${albums
          .map((row, i) => {
            const yearBit = row.year_label
              ? escapeHtml(row.year_label)
              : "年份不詳";
            const titleHtml =
              typeof DL.albumNameHTML === "function"
                ? DL.albumNameHTML(row.name)
                : escapeHtml(row.name);
            return `<li>
              <span class="ff-rank">${i + 1}.</span>
              <div class="ff-item-body">
                <button type="button" class="ff-link ff-main" data-open-album="${escapeHtml(row.name)}">${titleHtml}</button>
                <div class="ff-sub">${yearBit} · ${row.song_count} 首</div>
              </div>
            </li>`;
          })
          .join("")}
      </ol>`;
      }

      albumsRoot.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-open-album]");
        if (!btn) return;
        Overlay.openAlbum(btn.getAttribute("data-open-album"), { push: false });
      });
    }
  } catch (err) {
    console.error(err);
    const msg = `<p class="ff-lead">${escapeHtml(err.message || String(err))}</p>`;
    concertsRoot.innerHTML = msg;
    if (albumsRoot) albumsRoot.innerHTML = msg;
  }
})();
