// Standalone Node.js script to populate tracker-data.json with TMDb details
// (Plain JavaScript version with Debugging + fetch fix attempt + typeof log)

// Import necessary modules
const fs = require('fs').promises;
const path = require('path');
// Import node-fetch and assign to a specific variable
const nodeFetch = require('node-fetch');
// *** NUEVO LOG DE DIAGNÓSTICO ***
console.log('Type of nodeFetch after require:', typeof nodeFetch);
const dotenv = require('dotenv'); // Import dotenv itself to check result

// --- START DEBUGGING SECTION ---
console.log('Script starting...');
console.log('Attempting to load .env.local...');
console.log('Current working directory:', process.cwd());
console.log('Expected .env.local path:', path.resolve(__dirname, '.env.local'));

const dotenvResult = dotenv.config({ path: path.resolve(__dirname, '.env.local') });

if (dotenvResult.error) {
  console.error('ERROR loading .env.local file:', dotenvResult.error);
} else {
  console.log('.env.local loaded successfully (or file not found/empty). Parsed variables:', dotenvResult.parsed);
}

const apiKeyFromEnv = process.env.TMDB_API_KEY;
console.log('Value of process.env.TMDB_API_KEY right after dotenv.config():', apiKeyFromEnv ? '****** (loaded)' : apiKeyFromEnv);

if (!apiKeyFromEnv) {
    console.error('CRITICAL: TMDB_API_KEY is STILL undefined or empty after dotenv attempted to load.');
}
// --- END DEBUGGING SECTION ---


// --- Configuration ---
const TMDB_API_KEY = apiKeyFromEnv;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DATA_FILE_PATH = path.join(__dirname, 'data', 'tracker-data.json');
const API_DELAY_MS = 300;

// --- Helper Functions ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function searchAndGetFirstSeriesResult(title) {
  // Check if nodeFetch is actually a function before using it
  if (typeof nodeFetch !== 'function') {
      console.error(`CRITICAL ERROR inside searchAndGetFirstSeriesResult: nodeFetch is not a function (type: ${typeof nodeFetch}) when processing "${title}". Halting search.`);
      // Potentially throw an error or return null consistently
      return null;
  }

  if (!TMDB_API_KEY) {
    console.error(`Error in searchAndGetFirstSeriesResult: TMDB_API_KEY is missing when processing "${title}".`);
    return null;
  }

  const url = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=es-ES&page=1&include_adult=false`;
  console.log(`   Searching for series: "${title}"`);

  try {
    // Use the specific variable 'nodeFetch' here
    const response = await nodeFetch(url); // This is the line that might fail if typeof is not 'function'
    if (!response.ok) {
      console.error(`   TMDb search failed for "${title}" with status: ${response.status}`);
      return null;
    }
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.warn(`   WARN: No TMDb series results found for "${title}".`);
      return null;
    }

    const firstResult = data.results[0];
    const releaseYear = firstResult.first_air_date ? firstResult.first_air_date.substring(0, 4) : null;

    console.log(`   -> Found: "${firstResult.name}" (ID: ${firstResult.id}), Year: ${releaseYear}`);

    return {
      tmdbId: firstResult.id,
      title: title,
      type: 'series',
      posterPath: firstResult.poster_path,
      releaseYear: releaseYear,
      latestSeason: null,
      userSeason: '0',
      userEpisode: '0',
      rating: 0,
    };

  } catch (error) {
    // Log the specific error encountered during fetch/parse
    console.error(`   Error during TMDb search/fetch for "${title}":`, error); // Log the actual error object
    return null;
  }
}

// --- Main Script Logic ---
async function populateData() {
  console.log('Running main populateData function...');

   if (!TMDB_API_KEY) {
       console.error("Halting script: TMDB_API_KEY is not available.");
       return;
   }

  // 1. Read existing data
  let currentData = [];
  try {
    const dataDir = path.dirname(DATA_FILE_PATH);
    try {
        await fs.access(dataDir);
    } catch {
        console.log(`Data directory ${dataDir} not found, creating...`);
        await fs.mkdir(dataDir, { recursive: true });
    }

    const fileContent = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    currentData = JSON.parse(fileContent);
    console.log(`Read ${currentData.length} items from ${DATA_FILE_PATH}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
       console.log(`Data file ${DATA_FILE_PATH} not found. Starting with empty list.`);
       currentData = [];
    } else {
      console.error(`Error reading or parsing ${DATA_FILE_PATH}:`, error);
      return;
    }
  }

  // 2. Filter items needing update
  const itemsToUpdate = currentData.filter(item => item.type === 'series' && (!item.tmdbId || item.tmdbId === 0));

  if (itemsToUpdate.length === 0) {
    console.log('No series found needing tmdbId update.');
     try {
        const dataString = JSON.stringify(currentData, null, 2);
        await fs.writeFile(DATA_FILE_PATH, dataString, 'utf-8');
        console.log(`Wrote potentially validated data back to ${DATA_FILE_PATH}`);
      } catch (writeError) {
        console.error(`Error writing potentially validated data back to ${DATA_FILE_PATH}:`, writeError);
      }
    return;
  }

  console.log(`Found ${itemsToUpdate.length} series to update from TMDb...`);

  // 3. Fetch data for items needing update
  const fetchedDataMap = new Map();

  for (let i = 0; i < itemsToUpdate.length; i++) {
    const item = itemsToUpdate[i];
    console.log(`[${i + 1}/${itemsToUpdate.length}] Processing: "${item.title}"`);
    const fetchedInfo = await searchAndGetFirstSeriesResult(item.title);
    if (fetchedInfo) {
      fetchedDataMap.set(item.title, fetchedInfo);
    } else {
       console.log(`   Skipping update for "${item.title}" due to fetch error or no results.`);
    }
    if (i < itemsToUpdate.length - 1) {
      await delay(API_DELAY_MS);
    }
  }

  console.log(`Finished fetching data. Successfully fetched for ${fetchedDataMap.size} series.`);

  // 4. Update the original data array
  let updatedCount = 0;
  const finalData = currentData.map(item => {
    if (item.type === 'series' && (!item.tmdbId || item.tmdbId === 0) && fetchedDataMap.has(item.title)) {
      const fetched = fetchedDataMap.get(item.title);
      if (fetched && typeof fetched.tmdbId === 'number' && fetched.tmdbId > 0) {
          updatedCount++;
          console.log(`   Updating item "${item.title}" with TMDb ID ${fetched.tmdbId}`);
          return {
            ...item,
            tmdbId: fetched.tmdbId,
            posterPath: fetched.posterPath,
            releaseYear: fetched.releaseYear,
          };
      } else {
           console.log(`   Skipping update for "${item.title}" due to invalid fetched data.`);
           return item;
      }
    }
    return item;
  });

  console.log(`Updated ${updatedCount} series in the list.`);

  // 5. Write updated data back to file
  try {
    const dataString = JSON.stringify(finalData, null, 2);
    await fs.writeFile(DATA_FILE_PATH, dataString, 'utf-8');
    console.log(`Successfully wrote updated data back to ${DATA_FILE_PATH}`);
  } catch (error) {
    console.error(`Error writing updated data to ${DATA_FILE_PATH}:`, error);
  }

  console.log('Script finished.');
}

// Run the main function
populateData();
