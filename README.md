# Movie & Series Tracker

## Overview

Movie & Series Tracker is a Next.js application designed to help you keep track of movies and TV series you want to watch or are currently watching. It allows you to maintain a personal list, rate items, track watched seasons for series, and automatically fetch updated information (like the total number of seasons for a series) using The Movie Database (TMDb) API.

## Features

-   **Add Movies & Series**: Search TMDb and add items directly from the results to your list.
-   **Distinguish Types**: Clearly differentiates between movies and series.
-   **Track Watched Seasons**: For series, easily set and update the season number you have watched up to.
-   **Rate Items**: Rate movies and series using a 0-5 star system.
-   **Update Series Data**: Fetch the latest total season count for series directly from the TMDb API.
-   **Sort List**: Sort your collection by title (A-Z, Z-A) or by rating (High-Low, Low-High).
-   **Filter/Search List**: Quickly filter your list by title.
-   **Manage Collection**: Easily delete items from your list.
-   **Persistent Storage**: Your list, progress, and ratings are saved locally on the server using a JSON file.

## Technical Stack

-   **Framework**: Next.js with React
-   **Styling**: Tailwind CSS with ShadCN UI components
-   **API Integration**: The Movie Database (TMDb) API for metadata and season counts.
-   **Data Storage**: Server-side JSON file storage (`data/tracker-data.json`).
-   **API Key Management**: Uses environment variables (`.env.local`) for TMDb API key.

## Getting Started

### Prerequisites

-   Node.js 18.x or higher
-   npm or yarn
-   **TMDb API Key**: You need a free API key from [The Movie Database (TMDb)](https://www.themoviedb.org/). Register an account, go to Settings > API, and request a key (v3 auth).

### Installation

1.  Clone the repository (replace `your-repo-name` if applicable):
    ```bash
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    cd your-repo-name
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure API Key:**
    * Create a file named `.env.local` in the root directory of the project.
    * Add your TMDb API key to the file like this:
        ```ini
        # .env.local
        TMDB_API_KEY=TU_CLAVE_API_DE_TMDB_AQUI
        ```
    * **Important:** Add `.env.local` to your `.gitignore` file to avoid committing your API key.

4.  **Create Data Directory:**
    * Ensure a directory named `data` exists in the root of your project. The `tracker-data.json` file will be created here automatically.
    * Add `data/` to your `.gitignore`.

5.  Run the development server:
    ```bash
    npm run dev
    # or
    yarn dev
    ```

6.  Open [http://localhost:9002](http://localhost:9002) (or your configured port) in your browser.

## Usage

### Adding Movies/Series

1.  Click the "Añadir Película/Serie..." button.
2.  A dialog will open. Enter the title you want to search for in TMDb and click "Buscar".
3.  Select the correct movie or series from the search results. Items already in your list will be indicated and cannot be added again.
4.  The selected item will be added to your list.

### Rating Items

-   Click on the stars displayed on an item's card to set its rating (1-5 stars). Changes are saved automatically.

### Tracking Watched Seasons (Series Only)

1.  For items marked as "Serie", update the "Tu Temporada" input field to the last season number you completed.
2.  Changes are saved automatically.

### Filtering and Sorting

-   Use the "Filtrar por título..." input field to filter the list as you type.
-   Use the "Ordenar Por" dropdown to sort the list by Title or Rating in ascending or descending order.

### Updating Series Data

1.  Click the "Actualizar Datos" button.
2.  The app will contact the TMDb API for every *series* in your list.
3.  It will fetch and display the current total number of seasons listed on TMDb for each series. Movies are ignored during this process.

### Removing Items

-   Click the trash icon (<kbd><Trash /></kbd>) on any item card to remove it from your list.

## Project Structure

-   `src/app/page.tsx` - Main UI component and frontend logic.
-   `src/app/actions.ts` - Server Actions for data persistence (file I/O) and TMDb API interaction.
-   `src/components/ui/` - UI components (including `star-rating.tsx`).
-   `src/lib/utils.ts` - Utility functions (e.g., `cn` for class names).
-   `data/tracker-data.json` - (Created automatically) Stores the list of tracked items.
-   `.env.local` - (You create this) Stores your TMDb API key.

## License

📄 Licencia: Uso privado y exclusivo. Ver archivo (LICENSE) para más detalles.

