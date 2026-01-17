import { TMDB_BASE, TMDB_KEY } from "./config.js";

// Helper to determine type
export function detectAppType(item) {
    const isAnim = item.genre_ids && item.genre_ids.includes(16);
    const isJap = item.original_language === 'ja';
    if (isAnim && isJap) return 'anime';
    return item.media_type || 'movie';
}

export async function fetchTrending() {
    const res = await fetch(`${TMDB_BASE}/trending/all/week?api_key=${TMDB_KEY}&language=it-IT`);
    const data = await res.json();
    return (data.results || []).filter(i => i.media_type !== 'person').map(i => ({
        id: i.id,
        title: i.title || i.name,
        poster: i.poster_path ? `https://image.tmdb.org/t/p/w200${i.poster_path}` : 'https://via.placeholder.com/200',
        media_type: i.media_type,
        app_type: detectAppType(i),
        year: (i.release_date || i.first_air_date || "").substring(0, 4),
        genre_ids: i.genre_ids
    }));
}

export async function searchTMDB(query) {
    const res = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${query}&language=it-IT`);
    const data = await res.json();
    if (!data.results) return [];

    return data.results.filter(i => i.media_type === 'tv' || i.media_type === 'movie').map(i => ({
        id: i.id,
        title: i.title || i.name,
        poster: i.poster_path ? `https://image.tmdb.org/t/p/w200${i.poster_path}` : 'https://via.placeholder.com/200',
        media_type: i.media_type,
        app_type: detectAppType(i),
        year: (i.release_date || i.first_air_date || "").substring(0, 4),
        genre_ids: i.genre_ids
    }));
}

export async function fetchDetails(id, type) {
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    const res = await fetch(`${TMDB_BASE}/${endpoint}/${id}?api_key=${TMDB_KEY}&language=it-IT`);
    return await res.json();
}