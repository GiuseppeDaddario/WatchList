import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURATION ---
const TMDB_KEY = "693bb7c1cb06ae9e01982036e6898023";
const TMDB_BASE = "https://api.themoviedb.org/3";

const firebaseConfig = {
  apiKey: "AIzaSyAWulgAc4SodSdQ_rbut9QoTFpP4Sek5HM",
  authDomain: "watchlist-2ce12.firebaseapp.com",
  projectId: "watchlist-2ce12",
  storageBucket: "watchlist-2ce12.firebasestorage.app",
  messagingSenderId: "278070870340",
  appId: "1:278070870340:web:338e4ee0ac37ea26ab1711"
};

// --- INIT ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- STATE ---
let CURRENT_USER_ID = null;
let RAW_SEARCH_RESULTS = [];
let ALL_USER_ITEMS = [];

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        CURRENT_USER_ID = user.uid;
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        if(user.photoURL) document.getElementById('user-profile-pic').src = user.photoURL;
        document.getElementById('user-profile-pic').style.display = 'block';
        document.getElementById('default-avatar-icon').style.display = 'none';
        initDataListeners();
        loadTrending();
    } else {
        CURRENT_USER_ID = null;
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
});
document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => location.reload()));

function showToast(msg) {
    const box = document.getElementById('toast-container');
    if(!box) return;
    const el = document.createElement('div');
    el.className = 'toast'; el.innerHTML = msg;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 3000);
}

// --- LOGIC ---
function detectAppType(item) {
    const isAnim = item.genre_ids && item.genre_ids.includes(16);
    const isJap = item.original_language === 'ja';
    if (isAnim && isJap) return 'anime';
    return item.media_type || 'movie';
}

function initDataListeners() {
    const q = query(collection(db, "users", CURRENT_USER_ID, "watchlist"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        ALL_USER_ITEMS = [];
        snapshot.forEach(d => ALL_USER_ITEMS.push({ firebaseId: d.id, ...d.data() }));
        renderWatchlist();
        renderProfileStats();
    });
}

async function loadTrending() {
    const el = document.getElementById('search-results');
    el.innerHTML = '<div style="color:white;text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i><br>Loading...</div>';
    try {
        const res = await fetch(`${TMDB_BASE}/trending/all/week?api_key=${TMDB_KEY}`);
        const data = await res.json();
        RAW_SEARCH_RESULTS = (data.results||[]).filter(i=>i.media_type!=='person').map(i=>({
            id: i.id, title: i.title||i.name,
            poster: i.poster_path?`https://image.tmdb.org/t/p/w200${i.poster_path}`:'https://via.placeholder.com/200',
            media_type: i.media_type, app_type: detectAppType(i),
            year: (i.release_date||i.first_air_date||"").substring(0,4),
            genre_ids: i.genre_ids
        }));
        applyLocalFilter('all');
    } catch(e) { el.innerHTML = 'Error loading.'; }
}

document.getElementById('search-btn').addEventListener('click', async () => {
    const q = document.getElementById('search-input').value;
    if(!q) return;
    document.getElementById('search-results').innerHTML = '<div style="color:white;text-align:center;padding:20px;">Searching...</div>';
    try {
        const res = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${q}`);
        const data = await res.json();
        if(data.results) {
            RAW_SEARCH_RESULTS = data.results.filter(i=>i.media_type==='tv'||i.media_type==='movie').map(i=>({
                id: i.id, title: i.title||i.name,
                poster: i.poster_path?`https://image.tmdb.org/t/p/w200${i.poster_path}`:'https://via.placeholder.com/200',
                media_type: i.media_type, app_type: detectAppType(i),
                year: (i.release_date||i.first_air_date||"").substring(0,4),
                genre_ids: i.genre_ids
            }));
        }
        applyLocalFilter('all');
    } catch(e) { console.error(e); }
});

window.applyLocalFilter = (type, btn) => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    if(btn) btn.classList.add('active');
    else document.querySelector(`.chip[data-filter="${type}"]`)?.classList.add('active');

    const box = document.getElementById('search-results');
    box.innerHTML = '';
    const list = type==='all' ? RAW_SEARCH_RESULTS : RAW_SEARCH_RESULTS.filter(i=>i.app_type===type);

    if(list.length===0) { box.innerHTML='<div style="opacity:0.5;text-align:center;">No results.</div>'; return; }

    list.forEach(item => {
        const d = document.createElement('div'); d.className='glass-card';
        d.innerHTML = `
            <img src="${item.poster}" class="poster">
            <div class="card-info">
                <h3 class="card-title">${item.title}</h3>
                <div class="card-meta">${item.app_type.toUpperCase()} • ${item.year}</div>
                <button class="btn-add" onclick="fetchDetailsAndAdd('${encodeURIComponent(JSON.stringify(item))}', this)">+ Add</button>
            </div>`;
        box.appendChild(d);
    });
};

window.fetchDetailsAndAdd = async (str, btn) => {
    if(!CURRENT_USER_ID) return showToast("Login required");
    const origTxt = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner"></i>'; btn.disabled=true;

    const item = JSON.parse(decodeURIComponent(str));
    let final = { id:item.id, title:item.title, poster:item.poster, type:item.app_type, total_seasons:1, runtime_min:0, seasons_watched:0, genres:[] };

    try {
        const ep = item.media_type==='tv'?'tv':'movie';
        const d = await fetch(`${TMDB_BASE}/${ep}/${item.id}?api_key=${TMDB_KEY}`).then(r=>r.json());
        if(d.genres) final.genres = d.genres.map(g=>g.name);

        if(item.media_type==='tv') {
            final.total_seasons = d.number_of_seasons||1;
            const avg = (d.episode_run_time && d.episode_run_time[0])||24;
            const eps = d.number_of_episodes||12;
            final.runtime_min = Math.floor((avg*eps)/final.total_seasons);
        } else {
            final.runtime_min = d.runtime||100;
        }

        await addDoc(collection(db,"users",CURRENT_USER_ID,"watchlist"), {...final, timestamp:Date.now()});
        btn.innerHTML='<i class="fa-solid fa-check"></i>'; btn.style.background="rgba(46,204,113,0.4)";
        showToast(`Added ${item.title}`);
    } catch(e) {
        console.error(e); btn.innerHTML='Error'; setTimeout(()=>{btn.innerHTML=origTxt;btn.disabled=false;},2000);
    }
};

function renderWatchlist() {
    const box = document.getElementById('watchlist-items'); box.innerHTML='';
    const list = ALL_USER_ITEMS.filter(i=>i.seasons_watched < i.total_seasons);

    if(list.length===0) { document.getElementById('empty-list-msg').style.display='block'; return; }
    document.getElementById('empty-list-msg').style.display='none';

    list.forEach(i => {
        const d = document.createElement('div'); d.className='glass-card';
        let txt='', btn='';
        // Treat items with 1 season as "Movie-like" buttons
        if(i.total_seasons===1) {
            txt = `${i.type.toUpperCase()} • ${Math.floor(i.runtime_min/60)}h ${i.runtime_min%60}m`;
            btn = `<button class="btn-check" onclick="markSeason('${i.firebaseId}',${i.total_seasons},${i.seasons_watched})">Watched</button>`;
        } else {
            txt = `${i.type.toUpperCase()} • Season ${i.seasons_watched+1} of ${i.total_seasons}`;
            btn = `<button class="btn-check" onclick="markSeason('${i.firebaseId}',${i.total_seasons},${i.seasons_watched})"><i class="fa-solid fa-check"></i> S${i.seasons_watched+1} Done</button>`;
        }
        d.innerHTML = `
            <img src="${i.poster}" class="poster">
            <div class="card-info">
                <h3 class="card-title">${i.title}</h3><div class="card-meta">${txt}</div>
                <div style="display:flex;gap:10px;margin-top:5px;">${btn}
                <button class="btn-check" style="background:rgba(255,0,0,0.2)" onclick="removeItem('${i.firebaseId}')"><i class="fa-solid fa-trash"></i></button></div>
            </div>`;
        box.appendChild(d);
    });
}

function renderProfileStats() {
    let min=0, ani=0, mov=0, tv=0, eps=0, comp=0, genres={}, maxMin=0, titan=null;
    const box = document.getElementById('history-list'); box.innerHTML='';
    let hist = ALL_USER_ITEMS.filter(i=>i.seasons_watched>0);
    hist.sort((a,b)=>a.title.localeCompare(b.title));

    ALL_USER_ITEMS.forEach(i => {
        const w = i.seasons_watched||0;
        if(w>0) {
            if(i.type==='anime') ani++; else if(i.type==='movie') mov++; else tv+=w;
            const m = w*i.runtime_min; min+=m;
            if(m>maxMin) { maxMin=m; titan=i; }
            if(i.total_seasons===1) eps++; else eps+=(w*10);
            if(i.genres) i.genres.forEach(g=>genres[g]=(genres[g]||0)+1);
        }
        if(w>=i.total_seasons && i.total_seasons>0) comp++;
    });

    if(hist.length===0) box.innerHTML='<div style="opacity:0.5;text-align:center;">No history.</div>';
    else hist.forEach(i => {
        const fin = i.seasons_watched>=i.total_seasons;
        const sub = i.total_seasons===1 ? 'Watched' : `S${i.seasons_watched} / S${i.total_seasons}`;
        const d = document.createElement('div'); d.className='history-item';
        d.innerHTML=`<img src="${i.poster}"><div class="history-info" style="flex:1"><h4>${i.title} ${fin?'<i class="fa-solid fa-circle-check" style="color:#2ecc71;font-size:12px;"></i>':''}</h4><span>${sub}</span></div><button class="btn-icon-del" onclick="removeItem('${i.firebaseId}')"><i class="fa-solid fa-trash"></i></button>`;
        box.appendChild(d);
    });

    document.getElementById('stat-big-time').innerText = `${Math.floor(min/60)}h ${min%60}m`;
    document.getElementById('stat-days-calc').innerText = `${(min/1440).toFixed(1)} days`;
    document.getElementById('stat-total-eps').innerText = eps;
    document.getElementById('stat-movies').innerText = mov;
    document.getElementById('stat-anime').innerText = ani;
    const started = ALL_USER_ITEMS.filter(i=>i.seasons_watched>0).length;
    document.getElementById('stat-completed-ratio').innerText = started===0?'0%':`${Math.round((comp/started)*100)}%`;

    const tBox = document.getElementById('titan-container');
    if(titan) tBox.innerHTML=`<div class="titan-card"><img src="${titan.poster}" class="titan-poster"><div><div style="font-size:10px;color:#f1c40f;font-weight:bold;text-transform:uppercase;">Longest Obsession</div><div style="font-size:16px;font-weight:bold;">${titan.title}</div><div style="font-size:12px;opacity:0.7;">${Math.floor(maxMin/60)} hours</div></div></div>`;
    else tBox.innerHTML='';

    const gBox = document.getElementById('genre-chart'); gBox.innerHTML='';
    const sGen = Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(sGen.length===0) gBox.innerHTML='<div style="font-size:12px;opacity:0.5;text-align:center">No data.</div>';
    else {
        const max = sGen[0][1];
        sGen.forEach(([n,c]) => {
            const row = document.createElement('div'); row.className='genre-row';
            row.innerHTML=`<div class="genre-name">${n}</div><div class="genre-track"><div class="genre-fill" style="width:${(c/max)*100}%;background:hsl(${Math.floor(Math.random()*360)},70%,60%);"></div></div><div class="genre-count">${c}</div>`;
            gBox.appendChild(row);
        });
    }
}

window.markSeason = async (id, tot, cur) => {
    await updateDoc(doc(db,"users",CURRENT_USER_ID,"watchlist",id), {seasons_watched:cur+1});
    showToast(cur+1>=tot ? '<i class="fa-solid fa-trophy"></i> Completed!' : '<i class="fa-solid fa-check"></i> Watched');
};
window.removeItem = async (id) => {
    await deleteDoc(doc(db,"users",CURRENT_USER_ID,"watchlist",id));
    showToast('Removed');
};
window.switchTab = (t) => {
    document.querySelectorAll('.view').forEach(e=>e.classList.remove('active'));
    document.getElementById(`${t}-view`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
    if(t==='search')document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(t==='watchlist')document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(t==='profile')document.querySelectorAll('.nav-item')[2].classList.add('active');
    document.getElementById('page-title').innerText = t.charAt(0).toUpperCase()+t.slice(1);
};