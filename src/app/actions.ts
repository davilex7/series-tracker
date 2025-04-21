'use server';

import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch'; // Make sure node-fetch is installed
import { z } from 'zod'; // Import zod for validation

// --- TMDb Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- Data Structure for Storage ---
type ItemType = 'movie' | 'series';

// Define Zod schema for validation when reading/writing
const StoredItemInfoSchema = z.object({
    tmdbId: z.number().int().positive(),
    title: z.string().min(1),
    type: z.enum(['movie', 'series']),
    latestSeason: z.number().int().positive().nullable(),
    userSeason: z.string(),
    userEpisode: z.string(),
    rating: z.number().min(0).max(5), // Allow decimal ratings
    posterPath: z.string().nullable().optional(),
    releaseYear: z.string().nullable().optional(),
});

// Infer the TypeScript type from the Zod schema
type StoredItemInfo = z.infer<typeof StoredItemInfoSchema>;

// --- File Path Configuration ---
const dataDir = path.resolve(process.cwd(), 'data');
const dataFilePath = path.join(dataDir, 'tracker-data.json');

// --- Helper Functions for File I/O ---

async function ensureDataDirExists() {
    try {
        await fs.access(dataDir);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`Data directory not found at ${dataDir}. Creating...`);
            await fs.mkdir(dataDir, { recursive: true });
        } else {
            console.error(`Error accessing data directory ${dataDir}:`, error);
            throw error; // Re-throw other errors
        }
    }
}

// Reads the item list from the JSON file and validates with Zod
async function readTrackerData(): Promise<StoredItemInfo[]> {
    await ensureDataDirExists();
    try {
        await fs.access(dataFilePath); // Check if file exists
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        const parsedJson = JSON.parse(fileContent);

        // Validate the entire array structure
        const validationResult = z.array(StoredItemInfoSchema).safeParse(parsedJson);

        if (!validationResult.success) {
            console.warn(`Data validation failed for ${dataFilePath}. Errors:`, validationResult.error.errors);
            // Attempt to filter out invalid items instead of returning empty
            if (Array.isArray(parsedJson)) {
                const validItems = parsedJson.filter(item => StoredItemInfoSchema.safeParse(item).success);
                console.warn(`Returning ${validItems.length} valid items after filtering.`);
                return validItems as StoredItemInfo[];
            }
            return []; // Return empty if not an array or no valid items found
        }

        // Ensure userEpisode exists, default to '0' if not
        const validatedDataWithDefaults = validationResult.data.map(item => ({
            ...item,
            userEpisode: item.userEpisode ?? '0',
            rating: item.rating ?? 0, // Ensure rating has a default
            latestSeason: item.type === 'series' ? (item.latestSeason ?? null) : null, // Ensure latestSeason is null for movies
            userSeason: item.type === 'series' ? (item.userSeason ?? '0') : '0', // Ensure userSeason is '0' for movies
            posterPath: item.posterPath ?? null,
            releaseYear: item.releaseYear ?? null,
        }));


        return validatedDataWithDefaults;

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`Data file not found at ${dataFilePath}. Returning empty list.`);
            return [];
        } else if (error instanceof SyntaxError) {
            console.error(`Error parsing JSON from ${dataFilePath}. Check file integrity. Returning empty list.`, error);
            return [];
        } else {
            console.error(`Error reading tracker data file ${dataFilePath}:`, error);
            return [];
        }
    }
}

// Writes the item list to the JSON file after validation
async function writeTrackerData(itemList: StoredItemInfo[]): Promise<boolean> {
    await ensureDataDirExists();
    try {
        // Validate each item before writing
        const listToWrite = itemList
            .map(item => {
                const validation = StoredItemInfoSchema.safeParse(item);
                if (!validation.success) {
                    console.warn(`Invalid item found before writing, filtering out: ${item?.title || 'Unknown'}. Errors:`, validation.error.errors);
                    return null;
                }
                // Ensure consistent structure for saving
                return {
                    tmdbId: validation.data.tmdbId,
                    title: validation.data.title,
                    type: validation.data.type,
                    latestSeason: validation.data.type === 'series' ? validation.data.latestSeason : null,
                    userSeason: validation.data.type === 'series' ? (validation.data.userSeason ?? '0') : '0',
                    userEpisode: validation.data.type === 'series' ? (validation.data.userEpisode ?? '0') : '0',
                    rating: validation.data.rating ?? 0,
                    posterPath: validation.data.posterPath ?? null,
                    releaseYear: validation.data.releaseYear ?? null,
                };
            })
            .filter(item => item !== null); // Remove invalid items


        // Deduplicate based on tmdbId before final write
        const uniqueList = listToWrite.reduce((acc, current) => {
            if (current && !acc.some(item => item?.tmdbId === current.tmdbId)) {
                acc.push(current);
            } else if (current) {
                console.warn(`Duplicate tmdbId found and removed just before saving: ${current.tmdbId} (${current.title})`);
            }
            return acc;
        }, [] as (StoredItemInfo | null)[]);


        const dataString = JSON.stringify(uniqueList, null, 2); // Pretty print
        await fs.writeFile(dataFilePath, dataString, 'utf-8');
        console.log(`Tracker data successfully saved to ${dataFilePath}`);
        return true;
    } catch (error) {
        console.error(`Error writing tracker data file ${dataFilePath}:`, error);
        return false;
    }
}


// --- Server Actions ---

export async function loadItemsAction(): Promise<StoredItemInfo[]> {
    return await readTrackerData();
}

export async function saveItemsAction(itemList: StoredItemInfo[]): Promise<{ success: boolean }> {
    // Validation and deduplication now happen primarily in writeTrackerData
    const success = await writeTrackerData(itemList);
    return { success };
}

// --- TMDb API Interaction ---
// Interface for TMDb search results (as expected by frontend)
interface TmdbSearchResult {
    id: number;
    title?: string; // Movie
    name?: string; // Series
    media_type: 'movie' | 'tv';
    release_date?: string; // Movie
    first_air_date?: string; // Series
    poster_path?: string | null;
    overview?: string;
}

// Action to search TMDb
export async function searchTmdbAction(query: string): Promise<{ results: TmdbSearchResult[], error?: string }> {
    if (!TMDB_API_KEY) {
        console.error("TMDb API Key is missing.");
        return { results: [], error: 'TMDb API key is not configured on the server.' };
    }
    if (!query.trim()) {
        return { results: [], error: 'Search query cannot be empty.' };
    }

    // Use multi-search for movies and series
    const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es-ES&page=1&include_adult=false`;

    try {
        console.log(`Searching TMDb: ${url.replace(TMDB_API_KEY, 'TMDB_API_KEY_REDACTED')}`); // Avoid logging key
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`TMDb search failed: ${response.status}`, errorBody);
            throw new Error(`TMDb search failed with status: ${response.status}`);
        }
        const data = await response.json() as { results: any[] };

        // Filter and map results
        const filteredResults: TmdbSearchResult[] = data.results
            .filter(result => (result.media_type === 'movie' || result.media_type === 'tv') && result.id)
            .map(result => ({
                id: result.id,
                title: result.title,
                name: result.name,
                media_type: result.media_type,
                release_date: result.release_date,
                first_air_date: result.first_air_date,
                poster_path: result.poster_path,
                overview: result.overview,
            }));

        console.log(`TMDb search found ${filteredResults.length} movie/tv results for query: "${query}"`);
        return { results: filteredResults };
    } catch (error: any) {
        console.error('Error searching TMDb:', error);
        return { results: [], error: error.message || "An unknown error occurred during TMDb search." };
    }
}

// Helper to fetch details for a single TV series from TMDb
async function fetchSeriesDetailsFromTmdb(tmdbId: number): Promise<{ latestSeason: number | null, error?: string }> {
    if (!TMDB_API_KEY) return { latestSeason: null, error: 'TMDb API key missing.' };

    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-ES`;
    console.log(`Fetching TV details from TMDb for ID: ${tmdbId}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`TMDb returned 404 for TV ID: ${tmdbId}`);
                return { latestSeason: null, error: 'Serie no encontrada en TMDb (404).' };
            }
            const errorBody = await response.text();
            console.error(`TMDb TV details fetch failed: ${response.status}`, errorBody);
            throw new Error(`TMDb TV details fetch failed with status: ${response.status}`);
        }
        const data = await response.json() as { number_of_seasons?: number };
        const numberOfSeasons = data.number_of_seasons;

        if (typeof numberOfSeasons === 'number') {
            console.log(`Found ${numberOfSeasons} seasons for TV ID: ${tmdbId}`);
            return { latestSeason: numberOfSeasons, error: undefined };
        } else {
            console.warn(`Could not find number_of_seasons for TV ID: ${tmdbId}. Response:`, data);
            return { latestSeason: null, error: 'Número de temporadas no encontrado en la respuesta de TMDb.' };
        }
    } catch (error: any) {
        console.error(`Error fetching TV details for ${tmdbId}:`, error);
        return { latestSeason: null, error: error.message || "Error desconocido al obtener detalles de la serie." };
    }
}


// Action to update latest seasons from TMDb for all series in the list
export async function updateItemsFromTmdbAction(): Promise<{ updatedList: StoredItemInfo[], errors: { title: string, error: string }[] }> {
    console.log("Starting updateItemsFromTmdbAction...");
    if (!TMDB_API_KEY) {
        console.error("TMDb API Key is missing. Cannot update.");
        const currentItemList = await readTrackerData();
        // No need to write here, just return current state with error
        return { updatedList: currentItemList, errors: [{ title: "Error de Configuración", error: "Falta la clave API de TMDb en el servidor." }] };
    }

    const currentItemList = await readTrackerData();
    const seriesList = currentItemList.filter(item => item.type === 'series' && typeof item.tmdbId === 'number');

    if (seriesList.length === 0) {
        console.log("No series with valid TMDb IDs in the list to update.");
        // No need to write here if nothing changed
        return { updatedList: currentItemList, errors: [] };
    }

    console.log(`Found ${seriesList.length} series to update from TMDb.`);
    const updatePromises: Promise<{ tmdbId: number, latestSeason: number | null, error?: string }>[] = [];

    // Fetch details with delays
    for (let i = 0; i < seriesList.length; i++) {
        const series = seriesList[i];
        const promise = new Promise<{ tmdbId: number, latestSeason: number | null, error?: string }>(resolve => {
            setTimeout(async () => {
                const result = await fetchSeriesDetailsFromTmdb(series.tmdbId);
                resolve({ tmdbId: series.tmdbId, ...result });
            }, i * 250); // Simple delay, consider a more robust rate limiter for many items
        });
        updatePromises.push(promise);
    }

    const updateResults = await Promise.all(updatePromises);

    const updateErrors: { title: string, error: string }[] = [];
    const tmdbResultMap = new Map(updateResults.map(r => [r.tmdbId, r]));
    let itemsChanged = false; // Track if any item was actually updated

    const newUpdatedList: StoredItemInfo[] = currentItemList.map(item => {
        if (item.type === 'series' && tmdbResultMap.has(item.tmdbId)) {
            const result = tmdbResultMap.get(item.tmdbId)!;
            const originalTitle = seriesList.find(s => s.tmdbId === item.tmdbId)?.title || `ID ${item.tmdbId}`;

            if (result.error) {
                console.warn(`Error updating ${originalTitle}: ${result.error}`);
                updateErrors.push({ title: originalTitle, error: result.error });
                return item; // Return original item unchanged on error
            } else if (item.latestSeason !== result.latestSeason) { // Only update if the season number changed
                console.log(`Updating ${originalTitle} latestSeason from ${item.latestSeason} to ${result.latestSeason}`);
                itemsChanged = true;
                return {
                    ...item, // Spread existing item properties
                    latestSeason: result.latestSeason, // The updated field
                };
            } else {
                // No error and no change in season number
                return item;
            }
        }
        // Return movies or series that weren't targeted for update unchanged
        return item;
    });

    // Save the updated list back to the file ONLY if changes were made
    if (itemsChanged) {
        await writeTrackerData(newUpdatedList);
        console.log("Saved updated list to file.");
    } else {
        console.log("No changes detected in latest season counts, file not rewritten.");
    }


    console.log("updateItemsFromTmdbAction finished.");
    return { updatedList: newUpdatedList, errors: updateErrors };
}

// --- NEW AI Recommendation Action ---
// Define the structure for the recommendations returned to the client
interface RecommendationResult {
    title: string;
    reason?: string;
}

