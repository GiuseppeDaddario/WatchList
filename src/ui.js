import { state } from "./state.js";
import { markSeason, removeItem } from "./db.js";

export function showToast(msg) {
    const box = document.getElementById('toast-container');
    if(!box) return;
    const el = document.createElement('div');
    el.className = 'toast'; el.innerHTML = msg;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 3000);
}

export function switchTab(t) {
    document.querySelectorAll('.view').forEach(e=>e.classList.remove('active'));
    document.getElementById(`${t}-view`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
    if(t==='search')document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(t==='watchlist')document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(t==='profile')document.querySelectorAll('.nav-item')[2].classList.add('active');
    document.getElementById('page-title').innerText = t.charAt(0).toUpperCase()+t.slice(1);
}

export function switchWlTab(type, btn) {
    document.querySelectorAll('.wl-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.wl-section').forEach(s => s.classList.remove('active'));

    if(type === 'live') document.getElementById('section-live').classList.add('active');
    else document.getElementById('section-anime').classList.add('active');
}

export function toggleHistory(btn) {
    const wrapper = document.getElementById('history-wrapper');
    if (wrapper.style.display === 'none') {
        wrapper.style.display = 'block'; btn.classList.add('active');
    } else {
        wrapper.style.display = 'none'; btn.classList.remove('active');
    }
}

export function applyLocalFilter(type, btn) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else document.querySelector(`.chip[data-filter="${type}"]`)?.classList.add('active');

    const box = document.getElementById('search-results');
    box.innerHTML = '';
    const list = type==='all' ? state.searchResults : state.searchResults.filter(i=>i.app_type===type);

    if(list.length===0) { box.innerHTML='<div style="opacity:0.5;text-align:center;">No results.</div>'; return; }

    list.forEach(item => {
        const d = document.createElement('div'); d.className='glass-card';
        // Note: fetchDetailsAndAdd is attached to window in main.js
        const safeItemString = encodeURIComponent(JSON.stringify(item)).replace(/'/g, "%27");
        d.innerHTML = `
            <img src="${item.poster}" class="poster">
            <div class="card-info">
                <h3 class="card-title">${item.title}</h3>
                <div class="card-meta">${item.app_type.toUpperCase()} • ${item.year}</div>
                <button class="btn-add" onclick="window.fetchDetailsAndAdd('${safeItemString}', this)">+ Add</button>
            </div>`;
        box.appendChild(d);
    });
}

export function renderWatchlist() {
    const boxLive = document.getElementById('watchlist-live');
    const boxAnime = document.getElementById('watchlist-anime');
    boxLive.innerHTML = ''; boxAnime.innerHTML = '';

    // 1. Filter (Unfinished & Not Dropped)
    let list = state.userItems.filter(i => i.seasons_watched < i.total_seasons && !i.dropped);

    list.sort((a, b) => {
        const isNewA = a.seasons_watched === 0;
        const isNewB = b.seasons_watched === 0;

        // If A is new and B is started, A comes first (-1)
        if (isNewA && !isNewB) return -1;

        // If A is started and B is new, B comes first (1)
        if (!isNewA && isNewB) return 1;

        // If both are same status, sort by newest added (timestamp desc)
        return (b.timestamp || 0) - (a.timestamp || 0);
    });

    // 2. Handle Empty State
    if(list.length === 0) {
        document.getElementById('empty-list-msg').style.display = 'block';
        document.querySelector('.wl-tabs').style.display = 'none';
        document.getElementById('section-live').classList.remove('active');
        document.getElementById('section-anime').classList.remove('active');
        return;
    }

    document.getElementById('empty-list-msg').style.display = 'none';
    document.querySelector('.wl-tabs').style.display = 'flex';

    // 3. Split Data
    const liveItems = list.filter(i => i.type !== 'anime');
    const animeItems = list.filter(i => i.type === 'anime');

    const createCard = (i) => {
        const d = document.createElement('div'); d.className = 'glass-card';
        let txt = '', btn = '';
        const isMovie = i.type === 'movie';

        if(isMovie) {
            txt = `${i.type.toUpperCase()} • ${Math.floor(i.runtime_min/60)}h ${i.runtime_min%60}m`;
            btn = `<button class="btn-check" onclick="markSeason('${i.firebaseId}',${i.total_seasons},${i.seasons_watched})">Watched</button>`;
        } else if (i.total_seasons === 1) {
            const eps = i.total_episodes ? `${i.total_episodes} Eps` : '1 Season';
            txt = `${i.type.toUpperCase()} • ${eps}`;
            btn = `<button class="btn-check" onclick="markSeason('${i.firebaseId}',${i.total_seasons},${i.seasons_watched})">Watched</button>`;
        } else {
            txt = `${i.type.toUpperCase()} • Season ${i.seasons_watched+1} of ${i.total_seasons}`;
            btn = `<button class="btn-check" onclick="markSeason('${i.firebaseId}',${i.total_seasons},${i.seasons_watched})"><i class="fa-solid fa-check"></i> S${i.seasons_watched+1} Done</button>`;
        }

        d.innerHTML = `
            <img src="${i.poster}" class="poster">
            <div class="card-info">
                <h3 class="card-title">${i.title}</h3>
                <div class="card-meta">${txt}</div>
                <div style="display:flex;gap:10px;margin-top:5px;">${btn}
                <button class="btn-check" style="background:rgba(255,0,0,0.2)" onclick="removeItem('${i.firebaseId}')"><i class="fa-solid fa-trash"></i></button></div>
            </div>`;
        return d;
    };

    if(liveItems.length === 0) boxLive.innerHTML = '<div style="font-size:12px;opacity:0.3;padding:20px;text-align:center">List is empty.</div>';
    else liveItems.forEach(i => boxLive.appendChild(createCard(i)));

    if(animeItems.length === 0) boxAnime.innerHTML = '<div style="font-size:12px;opacity:0.3;padding:20px;text-align:center">List is empty.</div>';
    else animeItems.forEach(i => boxAnime.appendChild(createCard(i)));
}

export function renderProfileStats() {
    // 1. Initialize Counters
    let minLive = 0, minAnime = 0;
    let ani = 0, mov = 0, tv = 0, eps = 0, comp = 0;
    let genres = {};
    let maxMin = 0, titan = null;

    // 2. Prepare History List (Items with progress OR dropped items)
    // We filter items that have at least 1 season watched OR are marked as dropped
    let hist = state.userItems.filter(i => i.seasons_watched > 0 || i.dropped);

    // Sort by most recently updated/added
    hist.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));

    // 3. Loop Through All Items for Global Stats
    state.userItems.forEach(i => {
        const w = i.seasons_watched || 0;

        // Calculate stats only for watched portions
        if(w > 0) {
            // Count Types
            if(i.type === 'anime') ani++;
            else if(i.type === 'movie') mov++;
            else tv += w; // Count seasons for TV

            // Count Minutes
            const m = w * i.runtime_min;
            if (i.type === 'anime') minAnime += m;
            else minLive += m;

            // Check for "Titan" (Longest watched item)
            if(m > maxMin) { maxMin = m; titan = i; }

            // Count Episodes (Estimate 12 eps per season if not movie)
            if(i.type !== 'movie') eps += (w * (i.total_episodes && i.total_seasons===1 ? i.total_episodes : 12));
            else eps += 1; // Movies count as 1 "unit"

            // Count Genres
            if(i.genres) {
                i.genres.forEach(g => {
                    // Skip "Animation" genre for anime to avoid skewing stats
                    if (g !== 'Animation') {
                        genres[g] = (genres[g]||0) + 1;
                    }
                });
            }
        }

        // Count Completed Items
        if(w >= i.total_seasons && i.total_seasons > 0) comp++;
    });

    // 4. Update Stats UI Text
    const formatTime = (minutes) => {
        if(minutes < 60) return `${minutes}m`;
        const hours = minutes / 60;
        if(hours < 24) return `${Math.round(hours * 10) / 10}h`;
        const days = hours / 24;
        if(days < 30) return `${Math.round(days * 10) / 10}d`;
        const months = days / 30.44;
        if(months < 12) return `${Math.round(months * 10) / 10}mo`;
        const years = days / 365.25;
        return `${Math.round(years * 10) / 10}y`;
    };

    document.getElementById('stat-time-main').innerText = formatTime(minLive);
    document.getElementById('stat-time-anime').innerText = formatTime(minAnime);
    document.getElementById('stat-total-eps').innerText = eps;
    document.getElementById('stat-movies').innerText = mov;
    document.getElementById('stat-anime').innerText = ani;

    const started = state.userItems.filter(i => i.seasons_watched > 0).length;
    document.getElementById('stat-completed-ratio').innerText = started===0 ? '0%' : `${Math.round((comp/started)*100)}%`;

    // 5. Render "Titan" (Longest Obsession)
    const tBox = document.getElementById('titan-container');
    if(titan) {
        tBox.innerHTML=`
        <div class="titan-card">
            <img src="${titan.poster}" class="titan-poster">
            <div style="flex:1">
                <div style="font-size:9px;color:#f1c40f;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Longest Obsession</div>
                <div style="font-size:14px;font-weight:700;margin-top:2px;">${titan.title}</div>
                <div style="font-size:11px;opacity:0.7;">${formatTime(maxMin)} watched</div>
            </div>
        </div>`;
    } else tBox.innerHTML='';

    // 6. Render Genre Chart
    const gBox = document.getElementById('genre-chart'); gBox.innerHTML='';
    const sGen = Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0, 6); // Top 6 genres

    if(sGen.length===0) {
        gBox.innerHTML='<div style="font-size:11px;opacity:0.5;text-align:center">No data.</div>';
    } else {
        const max = sGen[0][1];
        sGen.forEach(([n,c]) => {
            const row = document.createElement('div'); row.className='genre-row';
            row.innerHTML=`
                <div class="genre-name">${n}</div>
                <div class="genre-track">
                    <div class="genre-fill" style="width:${(c/max)*100}%; background:hsl(${Math.random()*360},70%,60%);"></div>
                </div>
                <div class="genre-count">${c}</div>`;
            gBox.appendChild(row);
        });
    }

    // 7. RENDER SPLIT HISTORY LISTS
    const boxLive = document.getElementById('history-live');
    const boxAnime = document.getElementById('history-anime');

    // Safety check in case HTML elements aren't ready
    if(boxLive && boxAnime) {
        boxLive.innerHTML = '';
        boxAnime.innerHTML = '';

        const createHistoryCard = (i) => {
            const fin = i.seasons_watched >= i.total_seasons;
            let sub = '';

            // Status Logic
            if (i.dropped) {
                sub = `<span style="color:#e74c3c; font-weight:700;">Dropped (S${i.seasons_watched})</span>`;
            } else if (i.type === 'movie') {
                sub = 'Watched';
            } else if (i.total_seasons === 1) {
                sub = i.total_episodes ? `${i.total_episodes} Eps` : 'Watched';
            } else {
                sub = `S${i.seasons_watched} / S${i.total_seasons}`;
            }

            const d = document.createElement('div'); d.className='history-item';

            // Checkmark logic: Only show green check if finished AND NOT dropped
            const checkIcon = (fin && !i.dropped) ? '<i class="fa-solid fa-check" style="color:#2ecc71;font-size:10px;margin-left:5px;"></i>' : '';

            d.innerHTML=`
                <img src="${i.poster}" loading="lazy">
                <div class="history-info" style="flex:1">
                    <h4 style="margin:0; font-size:13px;">${i.title} ${checkIcon}</h4>
                    <span style="font-size:11px; opacity:0.6;">${sub}</span>
                </div>
                <button class="btn-icon-del" onclick="window.removeItem('${i.firebaseId}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>`;
            return d;
        };

        // Split Data
        const liveItems = hist.filter(i => i.type !== 'anime');
        const animeItems = hist.filter(i => i.type === 'anime');

        // Fill Live Container
        if(liveItems.length === 0) boxLive.innerHTML = '<div style="opacity:0.3;text-align:center;font-size:12px;padding:20px;">No history yet.</div>';
        else liveItems.forEach(i => boxLive.appendChild(createHistoryCard(i)));

        // Fill Anime Container
        if(animeItems.length === 0) boxAnime.innerHTML = '<div style="opacity:0.3;text-align:center;font-size:12px;padding:20px;">No history yet.</div>';
        else animeItems.forEach(i => boxAnime.appendChild(createHistoryCard(i)));
    }
}

export function switchHistoryTab(type, btn) {
    btn.parentNode.querySelectorAll('.wl-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('history-section-live').classList.remove('active');
    document.getElementById('history-section-anime').classList.remove('active');
    if(type === 'live') document.getElementById('history-section-live').classList.add('active');
    else document.getElementById('history-section-anime').classList.add('active');
}