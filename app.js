(function () {
  'use strict';

  const GENRES = {
    all:   '전체',
    trot:  '트로트',
    ballad:'발라드',
    kpop:  'K-POP',
    indie: '인디/팝',
    dance: '댄스',
    ost:   'OST',
  };

  const GENRE_MAP = {
    '영탁': 'trot', '오승근': 'trot', '조용필': 'trot', '이박사': 'trot',
    '장윤정': 'trot', '박현빈': 'trot', '김추자': 'trot', '박남정': 'trot',
    '나훈아': 'trot', '현철': 'trot',

    '임재범': 'ballad', '이승철': 'ballad', 'K.Will': 'ballad', '이선희': 'ballad',
    '이문세': 'ballad', '김광석': 'ballad', '김현식': 'ballad', '이광조': 'ballad',
    '이용': 'ballad', '시인과 촌장': 'ballad', '박효신': 'ballad', '에일리': 'ballad',
    '임창정': 'ballad', '엠씨더맥스': 'ballad', '백지영': 'ballad',

    'BTS': 'kpop', 'NewJeans': 'kpop', 'BLACKPINK': 'kpop', '(G)I-DLE': 'kpop',
    '르세라핌': 'kpop', '(여자)아이들': 'kpop', '동방신기': 'kpop', 'SHINee': 'kpop',
    '소녀시대': 'kpop', '슈퍼주니어': 'kpop', 'GD X TAEYANG': 'kpop', 'G-DRAGON': 'kpop',
    'BIGBANG': 'kpop', 'IVE': 'kpop', 'FIFTY FIFTY': 'kpop', 'DESTINY ROGERS': 'kpop',

    '이적': 'indie', '카니발': 'indie', '소찬휘': 'indie', '넬': 'indie',
    '버스커버스커': 'indie', '정승환': 'indie', '안재욱': 'indie', '이현우': 'indie',
    '허각': 'indie', '윤하': 'indie', '백예린': 'indie',

    'PSY': 'dance', '브레이브걸스': 'dance', '비비': 'dance', '지드래곤': 'dance',
    '에릭남': 'dance', '아이유': 'dance',

    '린': 'ost', '조규찬': 'ost', '써니힐': 'ost',
  };

  let currentGenre = 'all';
  let currentSort = 'title';
  let searchQuery = '';
  let toastTimer = null;

  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const resultsEl = document.getElementById('results');
  const statsEl = document.getElementById('statsText');
  const sortSelect = document.getElementById('sortSelect');
  const filterBar = document.getElementById('filterBar');
  const toast = document.getElementById('toast');

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
        render();
      });
      filterBar.appendChild(btn);
    });
  }

  function bindEvents() {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      clearBtn.classList.toggle('visible', searchQuery.length > 0);
      render();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.classList.remove('visible');
      searchInput.focus();
      render();
    });

    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      render();
    });
  }

  function getGenre(song) {
    return GENRE_MAP[song.artist] || 'indie';
  }

  function highlight(text, query) {
    if (!query) return escHtml(text);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escHtml(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function filter(songs) {
    return songs.filter(s => {
      const matchGenre = currentGenre === 'all' || getGenre(s) === currentGenre;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q
        || s.title.toLowerCase().includes(q)
        || s.artist.toLowerCase().includes(q)
        || s.tj.includes(q)
        || s.ky.includes(q);
      return matchGenre && matchQuery;
    });
  }

  function sort(songs) {
    return [...songs].sort((a, b) => {
      if (currentSort === 'artist') return a.artist.localeCompare(b.artist, 'ko');
      if (currentSort === 'tj') return a.tj.localeCompare(b.tj);
      if (currentSort === 'ky') return a.ky.localeCompare(b.ky);
      return a.title.localeCompare(b.title, 'ko');
    });
  }

  function copyCode(code, type) {
    const text = code;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast(`${type} ${code} 복사됨!`));
    } else {
      const el = document.createElement('textarea');
      el.value = text;
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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function render() {
    const filtered = filter(SONGS);
    const sorted = sort(filtered);
    const q = searchQuery;

    statsEl.textContent = `${sorted.length}곡`;

    if (sorted.length === 0) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🎤</div>
          <h3>검색 결과가 없습니다</h3>
          <p>다른 검색어나 장르를 선택해보세요</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    sorted.forEach((song, i) => {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.innerHTML = `
        <div class="song-rank">${i + 1}</div>
        <div class="song-info">
          <div class="song-title">${highlight(song.title, q)}</div>
          <div class="song-artist">${highlight(song.artist, q)}</div>
        </div>
        <div class="song-codes">
          <div class="code-badge badge-tj" data-code="${song.tj}" data-type="TJ" title="TJ 태진 코드 복사">
            <span class="label">TJ</span>${song.tj}
          </div>
          <div class="code-badge badge-ky" data-code="${song.ky}" data-type="KY" title="KY 금영 코드 복사">
            <span class="label">KY</span>${song.ky}
          </div>
        </div>`;

      card.querySelectorAll('.code-badge').forEach(badge => {
        badge.addEventListener('click', e => {
          e.stopPropagation();
          copyCode(badge.dataset.code, badge.dataset.type);
        });
      });

      fragment.appendChild(card);
    });

    resultsEl.innerHTML = '';
    resultsEl.appendChild(fragment);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
