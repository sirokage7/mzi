(function () {
  'use strict';

  const GENRES = {
    all: '전체', trot: '트로트', ballad: '발라드',
    kpop: 'K-POP', indie: '인디/팝', dance: '댄스', ost: 'OST',
  };

  const GENRE_MAP = {
    '영탁':'trot','오승근':'trot','조용필':'trot','이박사':'trot','장윤정':'trot',
    '박현빈':'trot','김추자':'trot','박남정':'trot','나훈아':'trot','현철':'trot',
    '임재범':'ballad','이승철':'ballad','K.Will':'ballad','이선희':'ballad',
    '이문세':'ballad','김광석':'ballad','김현식':'ballad','이광조':'ballad',
    '이용':'ballad','시인과 촌장':'ballad','박효신':'ballad','에일리':'ballad',
    '임창정':'ballad','엠씨더맥스':'ballad','백지영':'ballad',
    'BTS':'kpop','NewJeans':'kpop','BLACKPINK':'kpop','(G)I-DLE':'kpop',
    '르세라핌':'kpop','(여자)아이들':'kpop','동방신기':'kpop','SHINee':'kpop',
    '소녀시대':'kpop','슈퍼주니어':'kpop','GD X TAEYANG':'kpop','G-DRAGON':'kpop',
    'BIGBANG':'kpop','IVE':'kpop','FIFTY FIFTY':'kpop',
    '이적':'indie','카니발':'indie','소찬휘':'indie','넬':'indie',
    '버스커버스커':'indie','정승환':'indie','안재욱':'indie','이현우':'indie',
    '허각':'indie','윤하':'indie','백예린':'indie',
    'PSY':'dance','브레이브걸스':'dance','비비':'dance','지드래곤':'dance',
    '에릭남':'dance','아이유':'dance',
    '린':'ost','조규찬':'ost','써니힐':'ost',
  };

  // Local KY lookup map (title|artist → ky code)
  const KY_MAP = new Map(SONGS.map(s => [`${s.title}|${s.artist}`, s.ky]));

  let currentGenre = 'all';
  let currentSort = 'title';
  let searchQuery = '';
  let apiMode = false;       // true when showing API results
  let apiLoading = false;
  let apiResults = [];
  let currentPage = 1;
  let hasMore = false;
  let debounceTimer = null;
  let currentRequest = 0;   // for stale response detection
  let toastTimer = null;

  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const resultsEl = document.getElementById('results');
  const statsEl = document.getElementById('statsText');
  const sortSelect = document.getElementById('sortSelect');
  const filterBar = document.getElementById('filterBar');
  const toast = document.getElementById('toast');
  const officialPanel = document.getElementById('officialPanel');
  const tjLink = document.getElementById('tjLink');
  const kyLink = document.getElementById('kyLink');

  const TJ_BASE = 'https://www.tjmedia.com/tjsong/song_search.asp?searchDiv=1&searchText=';
  const KY_BASE = 'https://www.kumyoung.co.kr/ky_search/search.asp?searchType=1&searchText=';

  function init() {
    buildFilters();
    bindEvents();
    render();
  }

  function buildFilters() {
    filterBar.innerHTML = '';
    Object.entries(GENRES).forEach(([key, label]) => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (key === currentGenre ? ' active' : '');
      btn.dataset.genre = key;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        currentGenre = key;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (!apiMode) render();
      });
      filterBar.appendChild(btn);
    });
  }

  function bindEvents() {
    searchInput.addEventListener('input', onInput);
    clearBtn.addEventListener('click', onClear);
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      if (!apiMode) render();
    });
  }

  function onInput() {
    searchQuery = searchInput.value.trim();
    clearBtn.classList.toggle('visible', searchQuery.length > 0);
    updateOfficialLinks();
    clearTimeout(debounceTimer);

    if (!searchQuery) {
      apiMode = false;
      apiResults = [];
      apiLoading = false;
      currentPage = 1;
      render();
      return;
    }

    apiLoading = true;
    apiMode = true;
    currentPage = 1;
    render();
    debounceTimer = setTimeout(() => fetchApi(searchQuery, 1), 400);
  }

  function onClear() {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.classList.remove('visible');
    apiMode = false;
    apiResults = [];
    apiLoading = false;
    currentPage = 1;
    updateOfficialLinks();
    searchInput.focus();
    render();
  }

  async function fetchApi(q, page) {
    const reqId = ++currentRequest;
    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&page=${page}`;
      const resp = await fetch(url);
      if (reqId !== currentRequest) return; // stale

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      // Supplement KY codes from local DB
      const songs = data.songs.map(s => ({
        ...s,
        ky: s.ky || KY_MAP.get(`${s.title}|${s.artist}`) || null,
      }));

      if (page === 1) {
        apiResults = songs;
      } else {
        apiResults = [...apiResults, ...songs];
      }
      hasMore = data.hasMore;
      currentPage = page;
    } catch (e) {
      if (reqId !== currentRequest) return;
      // API failed — fallback to local search
      apiMode = false;
      showToast('서버 오류 — 로컬 DB로 검색합니다');
    } finally {
      if (reqId === currentRequest) {
        apiLoading = false;
        render();
      }
    }
  }

  function loadMore() {
    if (apiLoading || !hasMore) return;
    apiLoading = true;
    render();
    fetchApi(searchQuery, currentPage + 1);
  }

  function updateOfficialLinks() {
    const enc = encodeURIComponent(searchQuery);
    tjLink.href = searchQuery ? TJ_BASE + enc : 'https://www.tjmedia.com/tjsong/song_search.asp';
    kyLink.href = searchQuery ? KY_BASE + enc : 'https://www.kumyoung.co.kr/ky_search/search.asp';
    officialPanel.classList.toggle('has-query', !!searchQuery);
  }

  // ─── render helpers ──────────────────────────────────────────

  function getGenre(song) { return GENRE_MAP[song.artist] || 'indie'; }

  function highlight(text, q) {
    if (!q) return escHtml(text);
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escHtml(text).replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function filterLocal(songs) {
    return songs.filter(s => {
      const matchGenre = currentGenre === 'all' || getGenre(s) === currentGenre;
      const q = searchQuery.toLowerCase();
      const matchQ = !q || s.title.toLowerCase().includes(q)
        || s.artist.toLowerCase().includes(q)
        || s.tj.includes(q) || s.ky.includes(q);
      return matchGenre && matchQ;
    });
  }

  function sortLocal(songs) {
    return [...songs].sort((a, b) => {
      if (currentSort === 'artist') return a.artist.localeCompare(b.artist, 'ko');
      if (currentSort === 'tj') return a.tj.localeCompare(b.tj);
      if (currentSort === 'ky') return a.ky.localeCompare(b.ky);
      return a.title.localeCompare(b.title, 'ko');
    });
  }

  function copyCode(code, type) {
    if (!code) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => showToast(`${type} ${code} 복사됨!`));
    } else {
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast(`${type} ${code} 복사됨!`);
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function makeBadge(code, type) {
    const cls = type === 'TJ' ? 'badge-tj' : 'badge-ky';
    if (code) {
      return `<div class="code-badge ${cls}" data-code="${escHtml(code)}" data-type="${type}">
        <span class="label">${type}</span>${escHtml(code)}
      </div>`;
    }
    const enc = encodeURIComponent(searchQuery || '');
    const href = type === 'TJ'
      ? `https://www.tjmedia.com/tjsong/song_search.asp?searchDiv=1&searchText=${enc}`
      : `https://www.kumyoung.co.kr/ky_search/search.asp?searchType=1&searchText=${enc}`;
    return `<a class="code-badge ${cls} badge-link" href="${href}" target="_blank" rel="noopener">
      <span class="label">${type}</span>사이트 →
    </a>`;
  }

  function makeCard(song, index, q) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
      <div class="song-rank">${index + 1}</div>
      <div class="song-info">
        <div class="song-title">${highlight(song.title, q)}</div>
        <div class="song-artist">${highlight(song.artist, q)}</div>
      </div>
      <div class="song-codes">
        ${makeBadge(song.tj, 'TJ')}
        ${makeBadge(song.ky, 'KY')}
      </div>`;

    card.querySelectorAll('.code-badge[data-code]').forEach(badge => {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        copyCode(badge.dataset.code, badge.dataset.type);
      });
    });
    return card;
  }

  function renderSkeletons(n) {
    resultsEl.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'song-card skeleton-card';
      el.innerHTML = `
        <div class="skeleton" style="width:24px;height:16px;border-radius:4px"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <div class="skeleton" style="height:16px;width:60%"></div>
          <div class="skeleton" style="height:12px;width:35%"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <div class="skeleton" style="height:26px;width:80px;border-radius:8px"></div>
          <div class="skeleton" style="height:26px;width:80px;border-radius:8px"></div>
        </div>`;
      resultsEl.appendChild(el);
    }
  }

  function render() {
    // API mode: loading
    if (apiMode && apiLoading && apiResults.length === 0) {
      statsEl.textContent = '검색 중...';
      renderSkeletons(6);
      return;
    }

    // API mode: results
    if (apiMode) {
      const songs = apiResults;
      statsEl.textContent = songs.length > 0
        ? `${songs.length}곡${hasMore ? '+' : ''} (TJ 전체 DB)`
        : apiLoading ? '검색 중...' : '검색 결과 없음';

      if (songs.length === 0 && !apiLoading) {
        resultsEl.innerHTML = `
          <div class="empty-state">
            <div class="emoji">🎤</div>
            <h3>검색 결과가 없습니다</h3>
            <p>공식 사이트 버튼을 눌러 직접 확인해보세요</p>
          </div>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      songs.forEach((s, i) => fragment.appendChild(makeCard(s, i, searchQuery)));

      // Load more button
      if (hasMore || apiLoading) {
        const btn = document.createElement('button');
        btn.className = 'load-more-btn';
        btn.disabled = apiLoading;
        btn.textContent = apiLoading ? '로딩 중...' : '더 보기';
        btn.addEventListener('click', loadMore);
        fragment.appendChild(btn);
      }

      resultsEl.innerHTML = '';
      resultsEl.appendChild(fragment);
      return;
    }

    // Local DB mode
    const filtered = filterLocal(SONGS);
    const sorted = sortLocal(filtered);
    statsEl.textContent = `${sorted.length}곡 (인기곡 DB)`;

    if (sorted.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🎤</div>
          <h3>내부 DB에 없는 곡이에요</h3>
          <p>위의 공식 사이트 버튼으로<br>TJ·KY 전체 DB에서 찾아보세요</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    sorted.forEach((s, i) => fragment.appendChild(makeCard(s, i, searchQuery)));
    resultsEl.innerHTML = '';
    resultsEl.appendChild(fragment);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
