const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const TJ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Accept-Charset': 'EUC-KR,utf-8;q=0.7,*;q=0.3',
  'Referer': 'https://www.tjmedia.com/tjsong/song_search.asp',
};

const KY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.kumyoung.co.kr/',
};

async function fetchHtml(url, headers, encoding) {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return iconv.decode(Buffer.from(buf), encoding);
}

async function searchTJ(q, page, div) {
  const url = `https://www.tjmedia.com/tjsong/song_search.asp?searchDiv=${div}&searchText=${encodeURIComponent(q)}&strType=&intPage=${page}`;
  const html = await fetchHtml(url, TJ_HEADERS, 'euc-kr');
  const $ = cheerio.load(html);
  const songs = [];

  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length < 2) return;
    rows.each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find('td');
      if (cells.length < 4) return;
      const code = $(cells[1]).text().trim();
      const title = $(cells[2]).text().trim();
      const artist = $(cells[3]).text().trim();
      if (/^\d{4,6}$/.test(code) && title && artist) {
        songs.push({ tj: code, title, artist });
      }
    });
    if (songs.length > 0) return false; // found the right table
  });

  return songs;
}

async function searchKY(q, page, div) {
  // searchType: 1=제목, 2=가수, 3=번호
  const searchType = div === '2' ? 2 : 1;
  const url = `https://www.kumyoung.co.kr/ky_search/search.asp?intPage=${page}&searchType=${searchType}&searchText=${encodeURIComponent(q)}`;
  const html = await fetchHtml(url, KY_HEADERS, 'euc-kr');
  const $ = cheerio.load(html);
  const songs = [];

  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length < 2) return;
    rows.each((i, row) => {
      if (i === 0) return;
      const cells = $(row).find('td');
      if (cells.length < 4) return;
      const code = $(cells[1]).text().trim();
      const title = $(cells[2]).text().trim();
      const artist = $(cells[3]).text().trim();
      if (/^\d{4,6}$/.test(code) && title && artist) {
        songs.push({ ky: code, title, artist });
      }
    });
    if (songs.length > 0) return false;
  });

  return songs;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', page = '1', div = '1', source = 'both' } = req.query;

  if (!q.trim()) {
    return res.status(400).json({ error: '검색어를 입력하세요' });
  }

  try {
    let tjSongs = [], kySongs = [];

    if (source === 'tj' || source === 'both') {
      tjSongs = await searchTJ(q, page, div).catch(() => []);
    }
    if (source === 'ky' || source === 'both') {
      kySongs = await searchKY(q, page, div).catch(() => []);
    }

    // Merge: match by title+artist
    const merged = [];
    const kyMap = new Map(kySongs.map(s => [`${s.title}|${s.artist}`, s.ky]));

    if (tjSongs.length > 0) {
      tjSongs.forEach(s => {
        merged.push({
          title: s.title,
          artist: s.artist,
          tj: s.tj,
          ky: kyMap.get(`${s.title}|${s.artist}`) || null,
        });
      });
    } else {
      // TJ failed, return KY-only results
      kySongs.forEach(s => {
        merged.push({ title: s.title, artist: s.artist, tj: null, ky: s.ky });
      });
    }

    res.json({
      songs: merged,
      page: Number(page),
      hasMore: merged.length >= 20,
    });
  } catch (err) {
    console.error('search error:', err.message);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다' });
  }
};
