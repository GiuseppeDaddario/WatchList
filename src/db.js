import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./config.js";
import { state } from "./state.js";
import { renderWatchlist, renderProfileStats, showToast } from "./ui.js";

export function initDataListeners() {
    if(!state.currentUser) return;

    const q = query(collection(db, "users", state.currentUser, "watchlist"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        state.userItems = [];
        snapshot.forEach(d => state.userItems.push({ firebaseId: d.id, ...d.data() }));
        renderWatchlist();
        renderProfileStats();
    });
}

export async function addToWatchlist(itemData) {
    await addDoc(collection(db, "users", state.currentUser, "watchlist"), { ...itemData, timestamp: Date.now() });
}

export async function markSeason(id, tot, cur) {
    await updateDoc(doc(db, "users", state.currentUser, "watchlist", id), { seasons_watched: cur + 1 });
    showToast(cur + 1 >= tot ? '<i class="fa-solid fa-trophy"></i> Completed!' : '<i class="fa-solid fa-check"></i> Watched');
}

export async function removeItem(id) {
    const item = state.userItems.find(i => i.firebaseId === id);
    if (!item) return;

    const isInProgress = (item.seasons_watched > 0) && (item.seasons_watched < item.total_seasons) && (!item.dropped);

    if (isInProgress) {
        if(confirm("Stop watching? Progress saved in History.")) {
            await updateDoc(doc(db, "users", state.currentUser, "watchlist", id), { dropped: true });
            showToast('<i class="fa-solid fa-box-archive"></i> Moved to History');
        }
    } else {
        await deleteDoc(doc(db, "users", state.currentUser, "watchlist", id));
        showToast('Permanently Removed');
    }
}

export async function restoreItem(firebaseId) {
    await updateDoc(doc(db, "users", state.currentUser, "watchlist", firebaseId), {
        dropped: false,
        timestamp: Date.now()
    });
}