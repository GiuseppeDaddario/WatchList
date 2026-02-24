import { state } from "./state.js";
import { markSeason, removeItem } from "./db.js";
import { fetchDetails } from "./api.js";

let selectedItemRequestId = 0;

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[char]));
}

function formatMinutes(minutes) {
    if (!minutes || Number.isNaN(minutes)) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
}

function showSelectedItemEmpty(msg = "Tap a title to see more info.", prefix = "") {
    const empty = document.getElementById(`${prefix}selected-item-empty`);
    const content = document.getElementById(`${prefix}selected-item-content`);
    if(!empty || !content) return;
    empty.textContent = msg;
    empty.style.display = 'block';
    content.style.display = 'none';
    content.innerHTML = '';
}

function renderSelectedItemContent(item, details, loading = false, prefix = "") {
    const empty = document.getElementById(`${prefix}selected-item-empty`);
    const content = document.getElementById(`${prefix}selected-item-content`);
    if(!empty || !content) return;

    const mediaType = (item.app_type || item.type || item.media_type || "title").toUpperCase();
    const year = item.year || (details?.release_date || details?.first_air_date || "").substring(0, 4) || "N/A";
    const subtitle = `${mediaType} • ${year}`;

    const tags = [];
    if(details?.vote_average) tags.push(`Rating ${details.vote_average.toFixed(1)}/10`);
    if(details?.runtime) tags.push(formatMinutes(details.runtime));
    if(details?.number_of_seasons) tags.push(`${details.number_of_seasons} season${details.number_of_seasons > 1 ? 's' : ''}`);
    if(details?.number_of_episodes) tags.push(`${details.number_of_episodes} episodes`);
    if(details?.genres?.length) details.genres.slice(0, 4).forEach((g) => tags.push(g.name));

    const safeTitle = escapeHtml(item.title || "Untitled");
    const safePoster = escapeHtml(item.poster || "");
    const safeSubtitle = escapeHtml(subtitle);
    const safeOverview = escapeHtml(
        loading
            ? "Loading details..."
            : (details?.overview || "No description available for this title.")
    );

    content.innerHTML = `
        <div class="selected-item-header">
            <img src="${safePoster}" alt="${safeTitle}" class="selected-item-poster">
            <div style="flex:1;">
                <h3 class="selected-item-title">${safeTitle}</h3>
                <div class="selected-item-subtitle">${safeSubtitle}</div>
                <div class="selected-item-tags">
                    ${tags.slice(0, 6).map((tag) => `<span class="selected-item-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
        </div>
        <p class="selected-item-overview">${safeOverview}</p>`;

    empty.style.display = 'none';
    content.style.display = 'block';
}

export async function showItemInfo(item, prefix = "") {
    if(!item) return;
    const requestId = ++selectedItemRequestId;
    renderSelectedItemContent(item, null, true, prefix);

    try {
        const mediaType = item.media_type || (item.type === 'movie' ? 'movie' : 'tv');
        // Use fallback logic just in case the Watchlist item saves the API ID differently
        const itemId = item.id || item.api_id || item.tmdbId;
        const details = await fetchDetails(itemId, mediaType);

        if(requestId !== selectedItemRequestId) return;
        renderSelectedItemContent(item, details, false, prefix);
    } catch (e) {
        if(requestId !== selectedItemRequestId) return;
        renderSelectedItemContent(item, null, false, prefix);
    }
}

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

    if(list.length===0) {
        box.innerHTML='<div style="opacity:0.5;text-align:center;">No results.</div>';
        showSelectedItemEmpty("No title selected.");
        return;
    }

    showSelectedItemEmpty();

    list.forEach(item => {
        const d = document.createElement('div'); d.className='glass-card';
        d.style.cursor = 'pointer';
        d.setAttribute('role', 'button');
        d.tabIndex = 0;
        const safeItemString = encodeURIComponent(JSON.stringify(item)).replace(/'/g, "%27");
        d.innerHTML = `
            <img src="${item.poster}" class="poster">
            <div class="card-info">
                <h3 class="card-title">${item.title}</h3>
                <div class="card-meta">${item.app_type.toUpperCase()} • ${item.year}</div>
                <button class="btn-add">+ Add</button>
            </div>`;

        const addBtn = d.querySelector('.btn-add');
        addBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            window.fetchDetailsAndAdd(safeItemString, addBtn);
        });

        d.addEventListener('click', () => showItemInfo(item));
        d.addEventListener('keydown', (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showItemInfo(item);
            }
        });
        box.appendChild(d);
    });
}


function makeSwipeable(containerElement, frontElement, bgElement, onDeleteCallback) {
    let startX = 0;
    let startY = 0; // Added to track vertical scrolling
    let currentX = 0;
    let isDragging = false;
    let isOpen = false;
    let hasStartedSwiping = false; // Flag to track intentional swipe

    const openWidth = 80;
    const deleteThreshold = 180;

    if (bgElement && typeof bgElement.addEventListener === 'function') {
        bgElement.addEventListener('click', (e) => {
            e.stopPropagation();
            executeDelete();
        });
    }

    frontElement.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY; // Record initial Y position
        isDragging = true;
        hasStartedSwiping = false; // Reset the flag on new touch
        frontElement.style.transition = 'none';

        // REMOVED: bgElement.style.opacity = '1';
        // We no longer show the color on touch.
    }, { passive: true });

    frontElement.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        // If the user is scrolling vertically, cancel the horizontal swipe logic
        if (!hasStartedSwiping && Math.abs(deltaY) > Math.abs(deltaX)) {
            isDragging = false;
            return;
        }

        // Only trigger the swipe mechanics if they move horizontally by more than 5px
        if (Math.abs(deltaX) > 5) {
            hasStartedSwiping = true;

            // NOW we show the red background, because a true swipe has started
            if (bgElement && bgElement.style.opacity !== '1') {
                bgElement.style.opacity = '1';
            }
        }

        // Don't move the card if the threshold hasn't been met yet
        if (!hasStartedSwiping) return;

        currentX = isOpen ? -openWidth + deltaX : deltaX;
        if (currentX > 0) currentX = currentX * 0.15; // Elastic resistance if swiping right

        frontElement.style.transform = `translateX(${currentX}px)`;
    }, { passive: true });

    frontElement.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;

        const deltaX = e.changedTouches[0].clientX - startX;

        // Soft tap to close if already open
        if (isOpen && Math.abs(deltaX) < 10) {
            closeSwipe();
            return;
        }

        frontElement.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';

        if (currentX < -deleteThreshold) {
            executeDelete();
        } else if (currentX < -40 && (!isOpen || currentX < -openWidth + 20)) {
            openSwipe();
        } else {
            closeSwipe();
        }
    });

    function openSwipe() {
        isOpen = true;
        currentX = -openWidth;
        frontElement.style.transform = `translateX(-${openWidth}px)`;
        frontElement.classList.add('is-open');
    }

    function closeSwipe() {
        isOpen = false;
        currentX = 0;
        frontElement.style.transform = `translateX(0px)`;
        frontElement.classList.remove('is-open');
        // Hide the red background after it slides back shut
        setTimeout(() => { if (!isOpen && bgElement) bgElement.style.opacity = '0'; }, 300);
    }

    function executeDelete() {
        frontElement.style.transition = 'transform 0.3s ease-in';
        frontElement.style.transform = `translateX(-100%)`;
        setTimeout(() => {
            onDeleteCallback();
            containerElement.remove();
        }, 300);
    }
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
        if (isNewA && !isNewB) return -1;
        if (!isNewA && isNewB) return 1;
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

    const liveItems = list.filter(i => i.type !== 'anime');
    const animeItems = list.filter(i => i.type === 'anime');

    const createCard = (i) => {
        const d = document.createElement('div');
        d.style.position = 'relative';
        d.style.overflow = 'hidden';
        d.style.borderRadius = '16px'; // Smooth corners
        d.style.marginBottom = '10px';
        d.style.transform = 'translateZ(0)'; // Safari rounding fix

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
            <div class="swipe-delete-bg" style="position:absolute; inset:0; background:#ff453a; display:flex; align-items:center; justify-content:flex-end; padding-right:25px; color:#fff; opacity:0; transition:opacity 0.2s ease; cursor:pointer;">
                <i class="fa-solid fa-trash" style="font-size: 20px;"></i>
            </div>
            <div class="swipe-front glass-card" style="position:relative; z-index:2; margin:0; width:100%; cursor:pointer;">
                <img src="${i.poster}" class="poster">
                <div class="card-info">
                    <h3 class="card-title">${i.title}</h3>
                    <div class="card-meta">${txt}</div>
                    <div style="display:flex;gap:10px;margin-top:5px;">${btn}</div>
                </div>
            </div>`;

        const front = d.querySelector('.swipe-front');
        const bgLayer = d.querySelector('.swipe-delete-bg');

        // Pass the container, the front card sliding, and the static background
        makeSwipeable(d, front, bgLayer, () => removeItem(i.firebaseId));

        front.addEventListener('click', (event) => {
            if (front.classList.contains('is-open')) return;
            if (event.target.closest('button')) return;
            showItemInfo(i, 'wl-');
        });

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

    if(boxLive && boxAnime) {
        // Sort Alphabetically
        hist.sort((a, b) => {
            const titleA = (a.title || "").toUpperCase();
            const titleB = (b.title || "").toUpperCase();
            return titleA.localeCompare(titleB);
        });

        const liveItems = hist.filter(i => i.type !== 'anime');
        const animeItems = hist.filter(i => i.type === 'anime');

        const createHistoryCard = (i) => {
            const fin = i.seasons_watched >= i.total_seasons;
            let sub = '';

            if (i.dropped) sub = `<span style="color:#e74c3c; font-weight:700;">Dropped (S${i.seasons_watched})</span>`;
            else if (i.type === 'movie') sub = 'Watched';
            else if (i.total_seasons === 1) sub = i.total_episodes ? `${i.total_episodes} Eps` : 'Watched';
            else sub = `S${i.seasons_watched} / S${i.total_seasons}`;

            const checkIcon = (fin && !i.dropped) ? '<i class="fa-solid fa-check" style="color:#2ecc71;font-size:10px;margin-left:5px;"></i>' : '';

            const d = document.createElement('div');
            d.style.position = 'relative';
            d.style.overflow = 'hidden';
            d.style.borderRadius = '10px';
            d.style.marginBottom = '8px';
            d.style.transform = 'translateZ(0)';

            d.innerHTML = `
                <div class="swipe-delete-bg" style="position:absolute; inset:0; background:#ff453a; display:flex; align-items:center; justify-content:flex-end; padding-right:20px; color:#fff; opacity:0; transition:opacity 0.2s ease; cursor:pointer;">
                    <i class="fa-solid fa-trash" style="font-size: 16px;"></i>
                </div>
                <div class="swipe-front history-item" style="position:relative; z-index:2; margin:0; width:100%;">
                    <img src="${i.poster}" loading="lazy">
                    <div class="history-info" style="flex:1">
                        <h4 style="margin:0; font-size:13px;">${i.title} ${checkIcon}</h4>
                        <span style="font-size:11px; opacity:0.6;">${sub}</span>
                    </div>
                </div>`;

            const front = d.querySelector('.swipe-front');
            const bgLayer = d.querySelector('.swipe-delete-bg');

            makeSwipeable(d, front, bgLayer, () => removeItem(i.firebaseId));
            return d;
        };

        const renderCategorizedList = (items, container, prefix) => {
            container.innerHTML = '';
            if(items.length === 0) {
                container.innerHTML = '<div style="opacity:0.3;text-align:center;font-size:12px;padding:20px;">No history yet.</div>';
                return;
            }

            // Wrapper to hold list and sticky sidebar
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.position = 'relative';

            const listCol = document.createElement('div');
            listCol.style.flex = '1';
            listCol.style.paddingRight = '25px'; // Leave room for A-Z sidebar

            const azCol = document.createElement('div');
            azCol.style.display = 'flex';
            azCol.style.flexDirection = 'column';
            azCol.style.alignItems = 'center';
            azCol.style.justifyContent = 'center';
            azCol.style.fontSize = '10px';
            azCol.style.fontWeight = 'bold';
            azCol.style.color = 'var(--accent-color, #3498db)';
            azCol.style.gap = '3px';

            let currentLetter = '';
            const lettersUsed = [];

            items.forEach(i => {
                let letter = (i.title || "#").charAt(0).toUpperCase();
                if (!/[A-Z]/.test(letter)) letter = '#';

                // Add Letter Header if it's a new letter
                if (letter !== currentLetter) {
                    currentLetter = letter;
                    lettersUsed.push(currentLetter);

                    const header = document.createElement('div');
                    header.id = `idx-${prefix}-${currentLetter}`;
                    header.innerText = currentLetter;
                    header.style.padding = '15px 0 5px';
                    header.style.fontSize = '14px';
                    header.style.fontWeight = '800';
                    header.style.opacity = '0.6';
                    listCol.appendChild(header);
                }
                listCol.appendChild(createHistoryCard(i));
            });

            // Populate A-Z sidebar
            lettersUsed.forEach(l => {
                const letterBtn = document.createElement('div');
                letterBtn.innerText = l;
                letterBtn.style.padding = '2px 5px';
                letterBtn.style.cursor = 'pointer';

                const scrollToLetter = (e) => {
                    e.preventDefault();
                    document.getElementById(`idx-${prefix}-${l}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };

                letterBtn.addEventListener('click', scrollToLetter);
                letterBtn.addEventListener('touchstart', scrollToLetter, { passive: false });
                azCol.appendChild(letterBtn);
            });

            const sidebarContainer = document.createElement('div');
            sidebarContainer.style.position = 'sticky';
            sidebarContainer.style.top = '10px';
            sidebarContainer.style.height = 'max-content';
            sidebarContainer.style.alignSelf = 'flex-start'; // Ensures it sticks correctly
            sidebarContainer.appendChild(azCol);

            wrapper.appendChild(listCol);
            wrapper.appendChild(sidebarContainer);
            container.appendChild(wrapper);
        };

        renderCategorizedList(liveItems, boxLive, 'live');
        renderCategorizedList(animeItems, boxAnime, 'anime');
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
