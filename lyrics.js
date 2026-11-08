const API = 'https://lrclib.net/api/search';
const audio = document.getElementById('audio');
let currentKey = '';
let lyricRows = [];
let tick = null;

const normalize = value => String(value || '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

function readTrack() {
  return {
    title: document.getElementById('ft')?.textContent?.trim() || '',
    artist: document.getElementById('fa')?.textContent?.trim() || '',
    duration: Number(audio?.duration) || 0,
  };
}

function lrcToRows(lrc) {
  const rows = [];
  for (const line of String(lrc || '').split(/\r?\n/)) {
    const text = line.replace(/\[[^\]]+\]/g, '').trim();
    const times = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    for (const match of times) {
      const fraction = Number(`0.${String(match[3] || '0').padEnd(3, '0')}`);
      const time = Number(match[1]) * 60 + Number(match[2]) + fraction;
      if (text) rows.push({ time, text });
    }
  }
  return rows.sort((a, b) => a.time - b.time);
}

function scoreResult(result, track) {
  const title = normalize(result.trackName);
  const artist = normalize(result.artistName);
  const wantedTitle = normalize(track.title);
  const wantedArtist = normalize(track.artist);
  if (!title || !artist || !wantedTitle || !wantedArtist) return -1;
  let score = title === wantedTitle ? 8 : title.includes(wantedTitle) || wantedTitle.includes(title) ? 3 : -5;
  score += artist === wantedArtist ? 8 : artist.includes(wantedArtist) || wantedArtist.includes(artist) ? 3 : -5;
  if (track.duration > 0 && Number(result.duration) > 0) {
    const delta = Math.abs(Number(result.duration) - track.duration);
    if (delta <= 3) score += 5;
    else if (delta <= 8) score += 2;
    else if (delta > 20) score -= 5;
  }
  return score;
}

async function findLyrics(track) {
  const query = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
  if (track.duration) query.set('duration', String(Math.round(track.duration)));
  const response = await fetch(`${API}?${query}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Тексты временно недоступны (${response.status})`);
  const results = await response.json();
  const ranked = (Array.isArray(results) ? results : [])
    .map(item => ({ item, score: scoreResult(item, track) }))
    .filter(x => x.score >= 12)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) throw new Error('Не нашёл надёжное совпадение для этой записи');
  const item = ranked[0].item;
  const synced = lrcToRows(item.syncedLyrics);
  const plain = String(item.plainLyrics || '').trim();
  if (!synced.length && !plain) throw new Error('Для этой записи текст не найден');
  return { synced, plain, label: `${item.artistName} — ${item.trackName}` };
}

function ensureOverlay() {
  let overlay = document.getElementById('accurateLyrics');
  if (overlay) return overlay;
  const style = document.createElement('style');
  style.textContent = `
    #accurateLyrics{position:fixed;inset:0;z-index:500;background:rgba(8,8,18,.97);color:#fff;display:none;flex-direction:column;padding:calc(env(safe-area-inset-top) + 14px) 20px calc(env(safe-area-inset-bottom) + 18px);}
    #accurateLyrics.open{display:flex}#accurateLyrics header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0 18px}
    #accurateLyrics button{border:0;border-radius:20px;padding:10px 15px;background:#282942;color:#fff;font-size:14px}
    #accurateLyricsTitle{font-size:13px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #accurateLyricsBody{flex:1;overflow:auto;text-align:center;mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent);padding:28vh 8px;}
    #accurateLyricsBody .lyric-line{font-size:21px;font-weight:700;line-height:1.45;padding:10px 0;color:#888;transition:color .2s,transform .2s}
    #accurateLyricsBody .lyric-line.active{color:#fff;transform:scale(1.04)}
    #accurateLyricsStatus{margin:auto;text-align:center;color:#bbb;line-height:1.5}
  `;
  document.head.append(style);
  overlay = document.createElement('section');
  overlay.id = 'accurateLyrics';
  overlay.innerHTML = '<header><button type="button" id="accurateLyricsClose">Закрыть</button><span id="accurateLyricsTitle">Синхронный текст</span><span style="width:50px"></span></header><div id="accurateLyricsBody"><div id="accurateLyricsStatus">Нажмите «Текст» в плеере</div></div>';
  document.body.append(overlay);
  overlay.querySelector('#accurateLyricsClose').addEventListener('click', () => overlay.classList.remove('open'));
  return overlay;
}

function renderLyrics(data, track) {
  const overlay = ensureOverlay();
  const body = overlay.querySelector('#accurateLyricsBody');
  overlay.querySelector('#accurateLyricsTitle').textContent = data.label;
  if (data.synced.length) {
    lyricRows = data.synced;
    body.replaceChildren(...lyricRows.map(row => {
      const line = document.createElement('div');
      line.className = 'lyric-line';
      line.dataset.time = String(row.time);
      line.textContent = row.text;
      return line;
    }));
    syncActiveLine();
  } else {
    lyricRows = [];
    const pre = document.createElement('div');
    pre.style.cssText = 'white-space:pre-wrap;line-height:1.8;text-align:center;color:#eee;font-size:18px';
    pre.textContent = data.plain;
    body.replaceChildren(pre);
  }
}

function syncActiveLine() {
  if (!audio || !lyricRows.length) return;
  const time = Number(audio.currentTime) || 0;
  let active = -1;
  for (let i = 0; i < lyricRows.length; i++) {
    if (lyricRows[i].time <= time) active = i;
    else break;
  }
  const body = document.getElementById('accurateLyricsBody');
  const lines = body?.querySelectorAll('.lyric-line');
  if (!lines) return;
  lines.forEach((line, i) => line.classList.toggle('active', i === active));
  if (active >= 0) lines[active].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function openLyrics() {
  const overlay = ensureOverlay();
  const body = overlay.querySelector('#accurateLyricsBody');
  const track = readTrack();
  const key = `${normalize(track.artist)}|${normalize(track.title)}`;
  overlay.classList.add('open');
  if (!track.title || !track.artist) {
    body.innerHTML = '<div id="accurateLyricsStatus">Сначала включите песню</div>';
    return;
  }
  if (key === currentKey && (lyricRows.length || body.querySelector('pre'))) {
    syncActiveLine();
    return;
  }
  currentKey = key;
  lyricRows = [];
  body.innerHTML = '<div id="accurateLyricsStatus">Ищу точное совпадение…</div>';
  try {
    const data = await findLyrics(track);
    if (key !== `${normalize(readTrack().artist)}|${normalize(readTrack().title)}`) return;
    renderLyrics(data, track);
  } catch (error) {
    body.innerHTML = '';
    const status = document.createElement('div');
    status.id = 'accurateLyricsStatus';
    status.textContent = error.message || 'Не удалось загрузить текст';
    body.append(status);
  }
}

function addLyricsButton() {
  const textButton = document.getElementById('flt');
  if (!textButton || document.getElementById('accurateLyricsButton')) return;
  const button = document.createElement('button');
  button.id = 'accurateLyricsButton';
  button.type = 'button';
  button.textContent = 'Текст по треку';
  button.addEventListener('click', openLyrics);
  textButton.parentElement?.insertBefore(button, textButton.nextSibling);
  ensureOverlay();
}

if (audio) audio.addEventListener('timeupdate', syncActiveLine);
const playerInfo = document.getElementById('ft')?.parentElement;
if (playerInfo) new MutationObserver(addLyricsButton).observe(playerInfo, { childList: true, subtree: true, characterData: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLyricsButton, { once: true });
else addLyricsButton();
