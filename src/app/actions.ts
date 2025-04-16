'use server';

import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch'; // Make sure node-fetch is installed

// --- TMDb Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY; // Load API key from environment variable
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- Data Structure for Storage ---
type ItemType = 'movie' | 'series';

interface StoredItemInfo {
  tmdbId: number; // TMDb ID is now the primary identifier
  title: string;
  type: ItemType;
  latestSeason: number | null; // Store season count as number
  userSeason: string; // Keep as string for input flexibility, parse when needed
  rating: number; // 0-5
  // Store poster path and year for faster loading/display
  posterPath?: string | null;
  releaseYear?: string | null;
}

// --- File Path Configuration ---
const dataDir = path.resolve(process.cwd(), 'data');
// Rename the data file if you haven't already
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

// Reads the item list from the JSON file
async function readTrackerData(): Promise<StoredItemInfo[]> {
  await ensureDataDirExists();
  try {
    await fs.access(dataFilePath); // Check if file exists
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const parsedData = JSON.parse(fileContent) as any[]; // Parse as any[] for migration

    // Validate and map data, ensuring all fields exist
    // Filter out items missing the crucial tmdbId
    const validatedData = parsedData
      .map(item => {
         // Basic validation and default values
         const type: ItemType = item.type === 'movie' || item.type === 'series' ? item.type : 'movie';
         const tmdbId = typeof item.tmdbId === 'number' ? item.tmdbId : null;
         const rating = typeof item.rating === 'number' && item.rating >= 0 && item.rating <= 5 ? item.rating : 0;
         const latestSeason = type === 'series' && typeof item.latestSeason === 'number' ? item.latestSeason : null;
         const userSeason = type === 'series' ? String(item.userSeason || '0') : '0'; // Ensure string, default '0'

         if (tmdbId === null) {
             console.warn(`Item "${item.title || 'Unknown'}" is missing tmdbId and will be filtered out.`);
             return null; // Mark for filtering
         }

         return {
             tmdbId: tmdbId,
             title: item.title || 'Untitled',
             type: type,
             latestSeason: latestSeason,
             userSeason: userSeason,
             rating: rating,
             posterPath: item.posterPath !== undefined ? item.posterPath : null,
             releaseYear: item.releaseYear !== undefined ? item.releaseYear : null,
         };
      })
      .filter(item => item !== null); // Remove items marked as null (missing tmdbId)

    return validatedData as StoredItemInfo[];

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`Data file not found at ${dataFilePath}. Returning empty list.`);
      return [];
    } else if (error instanceof SyntaxError) {
      console.error(`Error parsing JSON from ${dataFilePath}. Check file integrity. Returning empty list.`, error);
      // Consider backup/recovery logic here
      return [];
    } else {
      console.error(`Error reading tracker data file ${dataFilePath}:`, error);
      return []; // Return empty on other errors
    }
  }
}

// Writes the item list to the JSON file
async function writeTrackerData(itemList: StoredItemInfo[]): Promise<boolean> {
  await ensureDataDirExists();
  try {
    // Ensure structure and filter out potential null/undefined before saving
    const listToWrite = itemList
        .filter(item => typeof item.tmdbId === 'number') // Ensure tmdbId is valid before saving
        .map(item => ({
            tmdbId: item.tmdbId,
            title: item.title,
            type: item.type,
            latestSeason: item.type === 'series' ? item.latestSeason : null,
            userSeason: item.type === 'series' ? item.userSeason : '0',
            rating: item.rating ?? 0,
            posterPath: item.posterPath,
            releaseYear: item.releaseYear,
        }));
    const dataString = JSON.stringify(listToWrite, null, 2); // Pretty print
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
  // Filter out potential duplicates based on tmdbId before saving
  const uniqueItemList = itemList.reduce((acc, current) => {
      if (typeof current.tmdbId !== 'number') return acc; // Skip items without valid id
      const x = acc.find(item => item.tmdbId === current.tmdbId);
      if (!x) {
          return acc.concat([current]);
      } else {
          console.warn(`Duplicate tmdbId found and removed before saving: ${current.tmdbId} (${current.title})`);
          return acc;
      }
  }, [] as StoredItemInfo[]);

  const success = await writeTrackerData(uniqueItemList);
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
      const currentItemList = await readTrackerData(); // Read data even if key is missing for potential migration
      await writeTrackerData(currentItemList); // Save potentially validated data
      return { updatedList: currentItemList, errors: [{ title: "Error de Configuración", error: "Falta la clave API de TMDb en el servidor." }] };
  }

  const currentItemList = await readTrackerData();
  const seriesList = currentItemList.filter(item => item.type === 'series' && typeof item.tmdbId === 'number');

  if (seriesList.length === 0) {
    console.log("No series with valid TMDb IDs in the list to update.");
    await writeTrackerData(currentItemList); // Save potentially validated data
    return { updatedList: currentItemList, errors: [] };
  }

  console.log(`Found ${seriesList.length} series to update from TMDb.`);
  const updatePromises: Promise<{ tmdbId: number, latestSeason: number | null, error?: string }>[] = [];

  // Create fetch promises with delay
  for (let i = 0; i < seriesList.length; i++) {
    const series = seriesList[i];
    const promise = new Promise<{ tmdbId: number, latestSeason: number | null, error?: string }>(resolve => {
      setTimeout(async () => {
        const result = await fetchSeriesDetailsFromTmdb(series.tmdbId);
        resolve({ tmdbId: series.tmdbId, ...result });
      }, i * 250); // API delay can often be shorter than scraping
    });
    updatePromises.push(promise);
  }

  const updateResults = await Promise.all(updatePromises);

  const updateErrors: { title: string, error: string }[] = [];
  const tmdbResultMap = new Map(updateResults.map(r => [r.tmdbId, r]));

  const newUpdatedList: StoredItemInfo[] = currentItemList.map(item => {
    // Only potentially update items that are series and were fetched
    if (item.type === 'series' && tmdbResultMap.has(item.tmdbId)) {
      const result = tmdbResultMap.get(item.tmdbId)!; // We know it exists
      const originalTitle = seriesList.find(s => s.tmdbId === item.tmdbId)?.title || `ID ${item.tmdbId}`; // Get title for error reporting

      if (result.error) {
        // If fetching details failed, return the original item completely unchanged
        console.warn(`Error updating ${originalTitle}: ${result.error}`);
        updateErrors.push({ title: originalTitle, error: result.error });
        return item; // Return original item unchanged
      } else {
        // If fetching was successful, update latestSeason and explicitly preserve others
        console.log(`Updating ${originalTitle} latestSeason to ${result.latestSeason}`);
        return {
            tmdbId: item.tmdbId,
            title: item.title,
            type: item.type,
            latestSeason: result.latestSeason, // The updated field
            userSeason: item.userSeason,       // Explicitly preserve
            rating: item.rating,               // Explicitly preserve
            posterPath: item.posterPath,       // Explicitly preserve posterPath
            releaseYear: item.releaseYear,     // Explicitly preserve releaseYear
        };
      }
    }
    // Return movies or series that weren't updated unchanged
    return item;
  });

  // Save the updated list back to the file
  await writeTrackerData(newUpdatedList);

  console.log("updateItemsFromTmdbAction finished.");
  return { updatedList: newUpdatedList, errors: updateErrors };
}
