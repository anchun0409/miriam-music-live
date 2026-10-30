// Shared data layer: loads data.json, builds per-song performance history
// grouped by concert (with all sessions listed), and exposes helpers used by
// both the main page and the ranking page.

// Attach to window so pages can detect load via window.DataLayer
// (top-level const does not become a window property).
window.DataLayer = (() => {
  let raw = null;
  let songsById = {};
  let sessionsById = {};
  let concertsById = {};

  const LOCAL_ONLY_COUNTRIES = new Set(["中國", "香港", "澳門"]);
  const VENUE_SHORT = {
    紅磡香港體育館: "紅館",
  };

  async function load() {
    if (raw) return raw;
    const res = await fetch("data/data.json", { cache: "no-store" });
    raw = await res.json();

    songsById = {};
    raw.songs.forEach((s) => (songsById[s.song_id] = s));

    concertsById = {};
    sessionsById = {};
    raw.concerts.forEach((c) => {
      concertsById[c.concert_id] = c;
      c.sessions.forEach((sess) => {
        sessionsById[sess.session_id] = { ...sess, concert_id: c.concert_id };
      });
    });

    return raw;
  }

  function shortVenue(venue) {
    if (!venue) return "";
    return VENUE_SHORT[venue] || venue;
  }

  function formatLocation(session, { withVenue = true } = {}) {
    const city = session.city || "";
    const country = session.country || "";
    const venue = shortVenue(session.venue || "");
    let place = city;
    if (country && !LOCAL_ONLY_COUNTRIES.has(country) && country !== city) {
      place = [city, country].filter(Boolean).join("/");
    }
    if (withVenue && venue) return `${place}（${venue}）`;
    return place;
  }

  function locationKey(session) {
    return [
      session.city || "",
      session.country || "",
      shortVenue(session.venue || ""),
    ].join("|");
  }

  function stripAlbumYear(album) {
    if (!album) return "";
    return album
      .replace(/\s*\(\d{4}\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // Wikipedia 專輯表 + 其他唱片中的單曲／翻唱（不含演唱會碟、電影電視劇原聲）。
  // tags: EP / 單曲 / 國語
  const ALBUM_CATALOG = [
    { name: "狼來了", year: 1996 },
    { name: "直覺", year: 1997 },
    { name: "私日記", year: 1997, tags: ["EP"] },
    { name: "到此一遊", year: 1998 },
    { name: "大激想", year: 1998, tags: ["EP"] },
    { name: "楊千嬅體驗入學", year: 1998, aliases: ["體驗入學"] },
    { name: "1-100", year: 1998, tags: ["EP"], aliases: ["Miriam 1 to 100"] },
    { name: "夏天的故事", year: 1999 },
    { name: "微笑", year: 1999, tags: ["國語"] },
    { name: "冬天的故事", year: 1999 },
    {
      name: "Play It Loud, Kiss Me Soft",
      year: 2000,
      tags: ["EP"],
      aliases: [
        "Play It Loud Kiss Me Soft",
        "Play It Loud avep2",
        "Kiss Me Soft（avep1）",
        "Kiss Me Soft(avep1)",
      ],
    },
    { name: "Miriam", year: 2001 },
    { name: "My Favourite Hits", year: 2001 },
    { name: "M VS M 上半場", year: 2002, tags: ["EP"], aliases: ["M Vs M上半場"] },
    { name: "M VS M 下半場", year: 2002, tags: ["EP"], aliases: ["M Vs M下半場"] },
    { name: "M VS M 總決賽", year: 2002, tags: ["EP"], aliases: ["M vs M總決賽"] },
    { name: "Miriam's Music Box", year: 2002 },
    { name: "揚眉", year: 2003, tags: ["國語"] },
    { name: "Make Up", year: 2003 },
    { name: "Miriam's Melodies", year: 2003 },
    { name: "2004開大", year: 2004, tags: ["EP"], aliases: ["2004 開大"] },
    { name: "電光幻影", year: 2004 },
    { name: "傻仔2004", year: 2004, aliases: ["傻仔新曲 + 精選", "傻仔新曲+精選"] },
    { name: "Single", year: 2005 },
    { name: "金經典", year: 2006 },
    { name: "Unlimited", year: 2006 },
    { name: "Simply Me", year: 2007 },
    { name: "Meridian", year: 2007 },
    { name: "Wonder Miriam", year: 2008 },
    { name: "原來過得很快樂", year: 2009 },
    { name: "千嬅盛放", year: 2009 },
    { name: "囍愛", year: 2010, aliases: ["囍愛楊千嬅"] },
    { name: "Home", year: 2010, tags: ["EP"], aliases: ["HOME"] },
    { name: "Ready or Not", year: 2011, tags: ["國語"], aliases: ["Ready Or Not"] },
    { name: "火鳥", year: 2012 },
    { name: "金牌10年精選系列", year: 2012, aliases: ["金牌10年精選系列 楊千嬅"] },
    { name: "如果大家都擁有海", year: 2015 },
    {
      name: "One on One Collection",
      year: 2018,
      aliases: ["One On One", "One on One"],
    },
    { name: "RECOLLECTION, VOL. I - MY Harmonic Minor", year: 2025 },
    {
      name: "MULTIVERSE OF CINEPOLY 40TH ANNIVERSARY - 楊千嬅",
      year: 2026,
    },
    { name: "金曲當年情", year: 2002, tags: ["單曲"] },
    { name: "色惑", year: 2014, tags: ["單曲"] },
    { name: "千嬅新唱金牌金曲", year: 2007 },
  ];

  function normalizeAlbumKey(name) {
    return String(name || "")
      .normalize("NFKC")
      .replace(/[，]/g, ",")
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  const albumByKey = (() => {
    const map = new Map();
    ALBUM_CATALOG.forEach((entry) => {
      const keys = [entry.name, ...(entry.aliases || [])];
      keys.forEach((k) => map.set(normalizeAlbumKey(k), entry));
    });
    return map;
  })();

  function resolveAlbumEntry(name) {
    if (!name) return null;
    return albumByKey.get(normalizeAlbumKey(name)) || null;
  }

  function canonicalizeAlbumName(name) {
    const entry = resolveAlbumEntry(name);
    return entry ? entry.name : name;
  }

  // Split multi-album fields on "), " between year tags so names that
  // contain commas (e.g. "Play It Loud, Kiss Me Soft (2000)") stay whole.
  function albumParts(album) {
    if (!album) return [];
    const rawAlbum = String(album).trim();
    if (!rawAlbum || rawAlbum.toLowerCase() === "n.a.") return [];

    const chunks = rawAlbum.split(/\)\s*,\s*/).map((chunk, i, arr) => {
      let s = chunk.trim();
      if (i < arr.length - 1 && !/\)$/.test(s)) s += ")";
      return canonicalizeAlbumName(stripAlbumYear(s));
    });

    const seen = new Set();
    return chunks.filter((p) => {
      if (!p || p.toLowerCase() === "n.a.") return false;
      const key = normalizeAlbumKey(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function albumNameHTML(name) {
    const entry = resolveAlbumEntry(name);
    const label = entry ? entry.name : name;
    const tags = (entry && entry.tags) || [];
    const tagHtml = tags
      .map((t) => {
        const cls =
          t === "EP"
            ? "tag-album-ep"
            : t === "單曲"
              ? "tag-album-single"
              : t === "國語"
                ? "tag-album-mandarin"
                : "tag-album-ep";
        return `<span class="${cls}">${t}</span>`;
      })
      .join("");
    return `${escapeHtmlPlain(label)}${tagHtml}`;
  }

  function escapeHtmlPlain(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // For a given song, build a list of "concert entries": one per concert,
  // each carrying every session (date/venue) at which the song was performed
  // under that concert, sorted most-recent-first.
  function performanceHistoryFor(songId) {
    const perfs = raw.performances.filter((p) => p.song_id === songId);
    const byConcert = {};

    perfs.forEach((p) => {
      const session = sessionsById[p.session_id];
      if (!session) return;
      const concert = concertsById[session.concert_id];
      if (!concert) return;
      if (!byConcert[concert.concert_id]) {
        byConcert[concert.concert_id] = {
          concert_id: concert.concert_id,
          concert_name: concert.concert_name,
          concert_name_english: concert.concert_name_english,
          sessions: [],
          latest_date: null,
        };
      }
      byConcert[concert.concert_id].sessions.push({
        ...session,
        is_main_rundown: p.is_main_rundown,
        notes: p.notes,
      });
    });

    const entries = Object.values(byConcert).map((entry) => {
      entry.sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
      entry.latest_date = entry.sessions[0]?.date || null;
      return entry;
    });

    entries.sort((a, b) => (a.latest_date < b.latest_date ? 1 : -1));
    return entries;
  }

  function performanceCountsFor(songId) {
    const history = performanceHistoryFor(songId);
    const shows = history.length;
    const times = history.reduce((n, e) => n + e.sessions.length, 0);
    return { shows, times };
  }

  function hasBeenPerformed(songId) {
    return performanceCountsFor(songId).times > 0;
  }

  function mostRecentDateFor(songId) {
    const history = performanceHistoryFor(songId);
    return history[0]?.latest_date || null;
  }

  function timeSince(dateStr) {
    if (!dateStr) return "尚無已知現場演出紀錄";
    const then = new Date(dateStr + "T00:00:00");
    const now = new Date();
    let years = now.getFullYear() - then.getFullYear();
    let months = now.getMonth() - then.getMonth();
    if (now.getDate() < then.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years <= 0 && months <= 0) return "一個月內";
    const parts = [];
    if (years > 0) parts.push(`${years} 年`);
    if (months > 0) parts.push(`${months} 個月`);
    return `${parts.join("")}前`;
  }

  function allSongs() {
    return raw.songs;
  }

  function ownSongs() {
    return raw.songs.filter((s) => !s.is_other_artist);
  }

  function isOtherArtist(songOrId) {
    const song =
      typeof songOrId === "string" ? songsById[songOrId] : songOrId;
    return !!(song && song.is_other_artist);
  }

  function originalArtist(songOrId) {
    const song =
      typeof songOrId === "string" ? songsById[songOrId] : songOrId;
    return (song && song.original_artist) || "";
  }

  function getConcert(concertId) {
    return concertsById[concertId] || null;
  }

  function getSong(songId) {
    return songsById[songId] || null;
  }

  function allConcerts() {
    return raw.concerts;
  }

  function allPerformances() {
    return raw.performances;
  }

  function allSessions() {
    return Object.values(sessionsById);
  }

  function isLakokConcert(concert) {
    const name = concert?.concert_name || "";
    return /拉闊|Music is Live/i.test(name);
  }

  // Fan labels for major solo shows vs world tours
  const GECHANG_CONCERT_IDS = new Set([
    "C001", // My Concert 花樣千嬅
    "C015", // 萬紫千紅
    "C017", // 開年大典 Vol.3
    "C022", // All About Love 2007
    "C025", // Ladies & Gentlemen
    "C002", // Minor Classics Live 2011
    "C003", // Let's Begin 2015
    "C004", // 三二一GO! 2017
    "C006", // B minor
    "C009", // RECOLLECTION 澳門
    "C008", // Live MY LIVE 2025
  ]);
  const GEXUN_CONCERT_IDS = new Set([
    "C005", // My Beautiful Live（中國）
    "C033", // My Beautiful Live（海外）
    "C007", // MY TREE OF LIVE 1.0（中國）
    "C031", // MY TREE OF LIVE 1.0（海外）
    "C034", // MY TREE OF LIVE 2.0
    "C032", // Live MY LIVE 1.0
  ]);

  function concertIdOf(concertOrId) {
    return typeof concertOrId === "string"
      ? concertOrId
      : concertOrId?.concert_id;
  }

  function isGechangConcert(concertOrId) {
    return GECHANG_CONCERT_IDS.has(concertIdOf(concertOrId));
  }

  function isGexunConcert(concertOrId) {
    return GEXUN_CONCERT_IDS.has(concertIdOf(concertOrId));
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Concert name + optional small「個唱」/「個巡」badge (HTML). */
  function concertNameHTML(concertOrId, nameOverride) {
    const concert =
      typeof concertOrId === "string"
        ? concertsById[concertOrId]
        : concertOrId;
    const name =
      nameOverride != null
        ? nameOverride
        : concert?.concert_name || String(concertOrId || "");
    const id = concertIdOf(concert || concertOrId);
    let tag = "";
    if (GEXUN_CONCERT_IDS.has(id)) {
      tag = '<span class="tag-gechang tag-gexun">個巡</span>';
    } else if (GECHANG_CONCERT_IDS.has(id)) {
      tag = '<span class="tag-gechang">個唱</span>';
    }
    return `${escapeHtml(name)}${tag ? ` ${tag}` : ""}`;
  }

  function isCollabOrSpecialConcert(concert) {
    const name = concert?.concert_name || "";
    return /拉闊|Music is Live|六神合體|MOOV Live|ID CLUB|狂熱份子|又一個叱吒|抱抱良音|AT17|女子十二樂坊/i.test(
      name
    );
  }

  /** Solo ticketed tours/shows (excludes 拉闊 / collab / radio specials). */
  function isPersonalConcert(concert) {
    return !!(concert && !isCollabOrSpecialConcert(concert));
  }

  /** Sources + Fun Facts theme coverage: every concert in the database. */
  function isThemeConcert(concert) {
    return !!concert;
  }

  function themeConcerts() {
    return raw.concerts
      .filter((c) => isThemeConcert(c))
      .map((c) => {
        const sessions = [...(c.sessions || [])].sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0
        );
        const cities = [...new Set(sessions.map((s) => s.city).filter(Boolean))];
        const countries = [
          ...new Set(sessions.map((s) => s.country).filter(Boolean)),
        ];
        return {
          concert: c,
          sessions,
          session_count: sessions.length,
          first_date: sessions[0]?.date || "",
          last_date: sessions[sessions.length - 1]?.date || "",
          cities,
          countries,
          is_lakok: isLakokConcert(c),
          is_personal: isPersonalConcert(c),
        };
      })
      .sort((a, b) =>
        a.first_date < b.first_date ? -1 : a.first_date > b.first_date ? 1 : 0
      );
  }

  /** Stats for Fun Facts page */
  function funFacts() {
    const sessions = allSessions();
    const themes = themeConcerts();

    const totalShows = sessions.length;
    const personalShows = sessions.filter((s) => {
      const c = concertsById[s.concert_id];
      return c && isPersonalConcert(c);
    }).length;

    const themeSessions = sessions.filter((s) => {
      const c = concertsById[s.concert_id];
      return c && isThemeConcert(c);
    });
    const countries = new Set(
      themeSessions.map((s) => s.country).filter(Boolean)
    );
    const cities = new Set(themeSessions.map((s) => s.city).filter(Boolean));

    // song count per session (exclude other-artist covers from the tally;
    // they still appear in rundown overlays)
    const perSession = {};
    raw.performances.forEach((p) => {
      const song = songsById[p.song_id];
      if (song && song.is_other_artist) return;
      perSession[p.session_id] = (perSession[p.session_id] || 0) + 1;
    });
    const sessionRows = sessions
      .map((s) => ({
        session: s,
        concert: concertsById[s.concert_id],
        count: perSession[s.session_id] || 0,
      }))
      .filter((r) => r.count > 0 && r.concert && isThemeConcert(r.concert))
      .sort((a, b) => b.count - a.count || (a.session.date < b.session.date ? 1 : -1));
    const topSongCountShows = sessionRows.slice(0, 5);

    // top 10 songs by performance times
    const songCounts = {};
    raw.performances.forEach((p) => {
      songCounts[p.song_id] = (songCounts[p.song_id] || 0) + 1;
    });
    const topSongs = Object.entries(songCounts)
      .map(([song_id, times]) => ({
        song: songsById[song_id],
        times,
      }))
      .filter((x) => x.song && !x.song.is_other_artist)
      .sort((a, b) => b.times - a.times || a.song.title.localeCompare(b.song.title, "zh-Hant"))
      .slice(0, 10);

    // cities by show count; equal 場次 grouped on one line (dense Top 5)
    const cityCounts = {};
    sessions.forEach((s) => {
      const city = s.city || "未知";
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const byTimes = new Map();
    Object.entries(cityCounts).forEach(([city, times]) => {
      if (!byTimes.has(times)) byTimes.set(times, []);
      byTimes.get(times).push(city);
    });
    const topCities = [...byTimes.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 5)
      .map(([times, cities], i) => ({
        rank: i + 1,
        times,
        cities: cities.sort((a, b) => a.localeCompare(b, "zh-Hant")),
      }));

    // encore top 5
    const encoreCounts = {};
    raw.performances.forEach((p) => {
      if (p.is_main_rundown !== false) return;
      encoreCounts[p.song_id] = (encoreCounts[p.song_id] || 0) + 1;
    });
    const encoreTop = Object.entries(encoreCounts)
      .map(([song_id, times]) => ({
        song: songsById[song_id],
        times,
      }))
      .filter((x) => x.song && !x.song.is_other_artist)
      .sort((a, b) => b.times - a.times || a.song.title.localeCompare(b.song.title, "zh-Hant"))
      .slice(0, 5);

    // Minor Classics / B minor → later main rundown elsewhere, excluding
    // songs already sung more than 3 times before their first Minor date.
    const minorConcertIds = new Set(
      raw.concerts
        .filter((c) => /Minor Classics|B minor/i.test(c.concert_name))
        .map((c) => c.concert_id)
    );
    const firstMinorDate = {};
    const firstMinorConcert = {};
    raw.performances.forEach((p) => {
      const sess = sessionsById[p.session_id];
      if (!sess || !minorConcertIds.has(sess.concert_id)) return;
      const prev = firstMinorDate[p.song_id];
      if (!prev || sess.date < prev) {
        firstMinorDate[p.song_id] = sess.date;
        firstMinorConcert[p.song_id] = sess.concert_id;
      }
    });
    const minorClassicsExclude = new Set(["超齡", "亦舒說", "我是羊"]);
    const minorThenMain = [];
    Object.keys(firstMinorDate).forEach((song_id) => {
      const song = songsById[song_id];
      if (!song || song.is_other_artist) return;
      const minorDate = firstMinorDate[song_id];
      const priorTimes = raw.performances.filter((p) => {
        if (p.song_id !== song_id) return false;
        const sess = sessionsById[p.session_id];
        return sess && sess.date < minorDate;
      }).length;
      // Exclude songs already sung more than 3 times before Minor / B minor
      // (= Minor was not 1st / 2nd / 3rd / 4th live). Keep prior ≤ 3.
      if (priorTimes > 3) return;

      const originName =
        concertsById[firstMinorConcert[song_id]]?.concert_name || "";
      if (
        /Minor Classics/i.test(originName) &&
        minorClassicsExclude.has(song.title)
      ) {
        return;
      }

      const laterMain = raw.performances.some((p) => {
        if (p.song_id !== song_id || p.is_main_rundown === false) return false;
        const sess = sessionsById[p.session_id];
        if (!sess || minorConcertIds.has(sess.concert_id)) return false;
        return sess.date > minorDate;
      });
      if (laterMain) {
        const origin = concertsById[firstMinorConcert[song_id]];
        minorThenMain.push({
          song,
          first_date: minorDate,
          first_concert: origin?.concert_name || firstMinorConcert[song_id],
          first_concert_id: firstMinorConcert[song_id],
          prior_times: priorTimes,
        });
      }
    });
    minorThenMain.sort((a, b) =>
      a.first_date < b.first_date ? -1 : a.first_date > b.first_date ? 1 : a.song.title.localeCompare(b.song.title, "zh-Hant")
    );

    return {
      totalShows,
      personalShows,
      themeConcertCount: themes.length,
      countryCount: countries.size,
      cityCount: cities.size,
      themeConcerts: themes,
      topSongCountShows,
      topSongs,
      topCities,
      encoreTop,
      minorThenMain,
    };
  }

  function songsInAlbum(albumName) {
    const target = canonicalizeAlbumName(stripAlbumYear(albumName));
    if (!target) return [];
    const targetKey = normalizeAlbumKey(target);
    return raw.songs.filter((s) =>
      albumParts(s.album).some((p) => normalizeAlbumKey(p) === targetKey)
    );
  }

  /** Parse album field into { name, year } chunks (year may be null). */
  function albumChunks(album) {
    if (!album) return [];
    const rawAlbum = String(album).trim();
    if (!rawAlbum || rawAlbum.toLowerCase() === "n.a.") return [];

    const pieces = rawAlbum.split(/\)\s*,\s*/).map((chunk, i, arr) => {
      let s = chunk.trim();
      if (i < arr.length - 1 && !/\)$/.test(s)) s += ")";
      return s;
    });

    return pieces
      .map((piece) => {
        const m = piece.match(/^(.*?)\s*\((\d{4})\)\s*$/);
        if (m) {
          const name = canonicalizeAlbumName(m[1].replace(/\s{2,}/g, " ").trim());
          if (!name || name.toLowerCase() === "n.a.") return null;
          return { name, year: Number(m[2]) };
        }
        const name = canonicalizeAlbumName(stripAlbumYear(piece));
        if (!name || name.toLowerCase() === "n.a.") return null;
        return { name, year: null };
      })
      .filter(Boolean);
  }

  /**
   * Albums on the Sources page: Wikipedia 專輯／單曲／翻唱 only
   * (excludes concert live discs and film/TV soundtracks).
   */
  function catalogAlbums() {
    const byName = new Map();
    ownSongs().forEach((song) => {
      const chunks = albumChunks(song.album);
      if (!chunks.length) return;
      chunks.forEach(({ name, year }) => {
        const meta = resolveAlbumEntry(name);
        if (!meta) return;
        const canon = meta.name;
        let entry = byName.get(canon);
        if (!entry) {
          entry = {
            name: canon,
            years: new Set(),
            song_ids: new Set(),
            tags: meta.tags || [],
            wiki_year: meta.year || null,
          };
          byName.set(canon, entry);
        }
        if (year) entry.years.add(year);
        else if (song.release_year) entry.years.add(Number(song.release_year));
        entry.song_ids.add(song.song_id);
      });
    });

    return [...byName.values()]
      .map((e) => {
        const years = [...e.years].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
        const year = e.wiki_year || (years.length ? years[0] : null);
        return {
          name: e.name,
          year,
          years,
          tags: e.tags,
          year_label: year ? String(year) : "",
          song_count: e.song_ids.size,
        };
      })
      .sort((a, b) => {
        const ya = a.year || 9999;
        const yb = b.year || 9999;
        if (ya !== yb) return ya - yb;
        return a.name.localeCompare(b.name, "zh-Hant");
      });
  }

  // Preserve JSON order of performances for a session as the setlist order.
  function setlistForSession(sessionId) {
    return raw.performances
      .filter((p) => p.session_id === sessionId)
      .map((p) => ({
        ...p,
        song: songsById[p.song_id] || null,
      }));
  }

  function sessionsForConcert(concertId) {
    const concert = concertsById[concertId];
    if (!concert) return [];
    return [...concert.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  return {
    load,
    performanceHistoryFor,
    performanceCountsFor,
    hasBeenPerformed,
    mostRecentDateFor,
    timeSince,
    allSongs,
    ownSongs,
    isOtherArtist,
    originalArtist,
    formatLocation,
    locationKey,
    stripAlbumYear,
    albumParts,
    songsInAlbum,
    albumChunks,
    catalogAlbums,
    albumNameHTML,
    resolveAlbumEntry,
    canonicalizeAlbumName,
    getConcert,
    getSong,
    allConcerts,
    allPerformances,
    allSessions,
    funFacts,
    themeConcerts,
    isPersonalConcert,
    isThemeConcert,
    isLakokConcert,
    isGechangConcert,
    isGexunConcert,
    concertNameHTML,
    setlistForSession,
    sessionsForConcert,
  };
})();
