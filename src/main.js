import { auth, provider } from "./config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { fetchTrending, searchTMDB, fetchDetails } from "./api.js";
import { initDataListeners, addToWatchlist, restoreItem, markSeason, removeItem } from "./db.js";
import { state } from "./state.js";
import * as UI from "./ui.js";

// --- EXPOSE FUNCTIONS TO HTML ---
window.applyLocalFilter = UI.applyLocalFilter;
window.switchTab = UI.switchTab;
window.switchWlTab = UI.switchWlTab;
window.toggleHistory = UI.toggleHistory;
window.switchHistoryTab = UI.switchHistoryTab;
window.markSeason = markSeason;
window.removeItem = removeItem;

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
    const loader = document.getElementById('loading-overlay');

    if (user) {
        state.currentUser = user.uid;
        if(user.photoURL) document.getElementById('user-profile-pic').src = user.photoURL;
        document.getElementById('user-profile-pic').style.display = 'block';
        document.getElementById('default-avatar-icon').style.display = 'none';

        initDataListeners();
        loadTrendingData();

        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';

        setTimeout(() => {
            if(loader) { loader.style.opacity = '0'; setTimeout(()=>loader.remove(), 500); }
        }, 500);
    } else {
        state.currentUser = null;
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-view').style.display = 'flex';
        if(loader) { loader.style.opacity = '0'; setTimeout(()=>loader.remove(), 500); }
    }
});

// --- EVENT LISTENERS ---
document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => location.reload()));

document.getElementById('search-btn').addEventListener('click', async () => {
    const q = document.getElementById('search-input').value;
    if(!q) return;
    document.getElementById('search-results').innerHTML = '<div style="color:white;text-align:center;padding:20px;">Searching...</div>';

    const results = await searchTMDB(q);
    state.searchResults = results;
    UI.applyLocalFilter('all');
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});

// --- HELPER LOGIC ---
async function loadTrendingData() {
    const el = document.getElementById('search-results');
    el.innerHTML = '<div style="color:white;text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i><br>Loading...</div>';
    try {
        const results = await fetchTrending();
        state.searchResults = results;
        UI.applyLocalFilter('all');
    } catch(e) { el.innerHTML = 'Error loading.'; }
}

// Logic to Add Item (Complex logic, kept here or in DB)
window.fetchDetailsAndAdd = async (str, btn) => {
    if(!state.currentUser) return UI.showToast("Login required");
    const origTxt = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner"></i>'; btn.disabled=true;

    const item = JSON.parse(decodeURIComponent(str));
    const existingItem = state.userItems.find(i => i.id === item.id);

    if (existingItem) {
        if (existingItem.dropped) {
            await restoreItem(existingItem.firebaseId);
            btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            UI.showToast(`Resumed S${existingItem.seasons_watched + 1}`);
        } else {
            UI.showToast("Already in Watchlist");
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        }
        setTimeout(()=>{ btn.innerHTML=origTxt; btn.disabled=false; }, 2000);
        return;
    }

    // New Item
    try {
        const details = await fetchDetails(item.id, item.media_type);

        let final = {
            id: item.id, title: item.title, poster: item.poster, type: item.app_type,
            total_seasons: 1, total_episodes: 0, runtime_min: 0, seasons_watched: 0, genres: []
        };

        if(details.genres) final.genres = details.genres.map(g=>g.name);

        if(item.media_type === 'tv') {
            final.total_seasons = details.number_of_seasons || 1;
            final.total_episodes = details.number_of_episodes || 0;
            const avg = (details.episode_run_time && details.episode_run_time[0]) || 24;
            const eps = final.total_episodes || 12;
            final.runtime_min = Math.floor((avg * eps) / final.total_seasons);
        } else {
            final.runtime_min = details.runtime || 100;
            final.total_episodes = 1;
        }

        await addToWatchlist(final);
        btn.innerHTML='<i class="fa-solid fa-check"></i>'; btn.style.background="rgba(46,204,113,0.4)";
        UI.showToast(`Added ${item.title}`);
    } catch(e) {
        console.error(e); btn.innerHTML='Error'; setTimeout(()=>{btn.innerHTML=origTxt;btn.disabled=false;},2000);
    }
};