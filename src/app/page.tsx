'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Trash, Star, Search, ArrowUpDown, Film, Tv, X, Loader2, PlusCircle } from "lucide-react"; // Added icons
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StarRating } from '@/components/ui/star-rating'; // Ensure this component exists
import {
  loadItemsAction,
  saveItemsAction,
  updateItemsFromTmdbAction, // Renamed action
  searchTmdbAction // Import search action
} from '@/app/actions';

// --- Interfaces ---
type ItemType = 'movie' | 'series';

// Frontend state includes UI flags
interface ItemInfo {
  tmdbId: number; // Use TMDb ID as primary key
  title: string;
  type: ItemType;
  latestSeason: number | null; // Store as number
  userSeason: string; // Keep as string for input
  rating: number;
  loadingUpdate?: boolean;
  errorUpdate?: string;
  posterPath?: string | null;
  releaseYear?: string | null;
}

// Data stored in the file
interface StoredItemInfo {
  tmdbId: number;
  title: string;
  type: ItemType;
  latestSeason: number | null;
  userSeason: string;
  rating: number;
  posterPath?: string | null;
  releaseYear?: string | null;
}

// TMDb search result structure
interface TmdbSearchResult {
  id: number;
  title?: string; // Movie
  name?: string; // Series
  media_type: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
}

// --- Sorting Types ---
type SortKey = 'default' | 'title' | 'rating';
type SortOrder = 'asc' | 'desc';
interface SortOption {
    value: string;
    label: string;
}

// --- Main Component ---
export default function Home() {
  const [itemList, setItemList] = useState<ItemInfo[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isUpdatingAll, setIsUpdatingAll] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortCriteria, setSortCriteria] = useState<string>('title-asc'); // Default sort: Title A-Z
  const { toast } = useToast();

  // State for TMDb Search Dialog
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbSearchResults, setTmdbSearchResults] = useState<TmdbSearchResult[]>([]);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [tmdbSearchError, setTmdbSearchError] = useState<string | null>(null);


  // --- Sorting Options ---
   const sortOptions: SortOption[] = [
        // { value: 'default', label: 'Por defecto' }, // Removed default, start with Title A-Z
        { value: 'title-asc', label: 'Título (A-Z)' },
        { value: 'title-desc', label: 'Título (Z-A)' },
        { value: 'rating-desc', label: 'Puntuación (Mayor a Menor)' },
        { value: 'rating-asc', label: 'Puntuación (Menor a Mayor)' },
    ];

  // --- Data Loading ---
  const loadItemList = useCallback(async () => {
    console.log("Loading item list...");
    setIsLoadingList(true);
    try {
      const storedList = await loadItemsAction();
      console.log("Loaded items:", storedList);
      setItemList(storedList.map(item => ({
          ...item,
          loadingUpdate: false,
          errorUpdate: undefined,
          posterPath: item.posterPath,
          releaseYear: item.releaseYear,
      })));
    } catch (error: any) {
        console.error("Error loading list:", error);
        toast({
            title: 'Error cargando lista',
            description: `No se pudieron cargar los datos: ${error.message}`,
            variant: 'destructive',
        });
        setItemList([]);
    } finally {
      setIsLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    loadItemList();
  }, [loadItemList]); // Depend on loadItemList

  // --- Data Saving Utility (Debounced) ---
  const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
        new Promise((resolve) => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            timeoutId = null;
            resolve(func(...args));
          }, waitFor);
        });
  };

  const saveItemsToServer = useCallback(async (listToSave: ItemInfo[]) => {
    const storedList: StoredItemInfo[] = listToSave.map(({ tmdbId, title, type, latestSeason, userSeason, rating, posterPath, releaseYear }) => ({
      tmdbId,
      title,
      type,
      latestSeason,
      userSeason,
      rating: rating ?? 0,
      posterPath,
      releaseYear,
    }));
    // console.log("Calling saveItemsAction with:", storedList); // Less verbose logging
    const result = await saveItemsAction(storedList); // Use renamed action
    if (!result.success) {
      console.error("Failed to save list to server.");
      toast({
        title: 'Error al guardar',
        description: 'No se pudo guardar la lista en el servidor.',
        variant: 'destructive',
      });
    } else {
      console.log("List saved successfully.");
      // toast({ title: 'Lista Guardada', description: 'Tu lista ha sido guardada.' }); // Optional success toast
    }
  }, [toast]);

  // Debounced save, increased delay slightly
  const debouncedSave = useCallback(debounce(saveItemsToServer, 1500), [saveItemsToServer]);

  // --- TMDb Search Logic ---
  const handleTmdbSearch = async () => {
      if (!tmdbSearchQuery.trim()) return;
      console.log(`Searching TMDb for: "${tmdbSearchQuery}"`);
      setIsSearchingTmdb(true);
      setTmdbSearchError(null);
      setTmdbSearchResults([]);
      try {
          const { results, error } = await searchTmdbAction(tmdbSearchQuery);
          if (error) {
              console.error("TMDb Search Error:", error);
              setTmdbSearchError(error);
              // toast({ title: "Error de Búsqueda en TMDb", description: error, variant: "destructive" });
          } else {
              console.log("TMDb Search Results:", results);
              setTmdbSearchResults(results);
              if (results.length === 0) {
                  setTmdbSearchError("No se encontraron resultados.");
              }
          }
      } catch (e: any) {
          console.error("Unexpected search error:", e);
          setTmdbSearchError("Error inesperado durante la búsqueda.");
          // toast({ title: "Error", description: "Error inesperado durante la búsqueda.", variant: "destructive" });
      } finally {
          setIsSearchingTmdb(false);
      }
  };

  // --- Add Item Logic (After Selecting from TMDb Search) ---
  const handleAddItemFromTmdb = (selectedItem: TmdbSearchResult) => {
      if (itemList.some(item => item.tmdbId === selectedItem.id)) {
          toast({
              title: "Elemento Duplicado",
              description: `"${selectedItem.title || selectedItem.name}" ya está en tu lista.`,
              variant: "warning",
          });
          // Keep dialog open for another search or manual close
          return;
      }

      const itemType: ItemType = selectedItem.media_type === 'tv' ? 'series' : 'movie';
      const itemTitle = selectedItem.title || selectedItem.name || 'Título Desconocido';
      const releaseDate = selectedItem.release_date || selectedItem.first_air_date;
      const releaseYear = releaseDate ? new Date(releaseDate).getFullYear().toString() : null;

      const newItem: ItemInfo = {
          tmdbId: selectedItem.id,
          title: itemTitle,
          type: itemType,
          latestSeason: null, // Fetched later by update action
          userSeason: '0',
          rating: 0,
          posterPath: selectedItem.poster_path,
          releaseYear: releaseYear,
          loadingUpdate: false,
          errorUpdate: undefined,
      };

      console.log("Adding new item:", newItem);
      const updatedList = [...itemList, newItem];
      setItemList(updatedList);
      debouncedSave(updatedList);

      toast({
          title: "Elemento Añadido",
          description: `"${itemTitle}" añadido a tu lista.`,
      });

      // Close dialog and clear search state
      setIsSearchDialogOpen(false);
      setTmdbSearchQuery('');
      setTmdbSearchResults([]);
      setTmdbSearchError(null);
  };


  // --- Other CRUD Operations ---
  const updateUserSeason = (tmdbId: number, newUserSeason: string) => {
    const seasonNum = parseInt(newUserSeason, 10);
    if ((isNaN(seasonNum) || seasonNum < 0) && newUserSeason !== '') return; // Allow empty string, prevent negative

    const updatedList = itemList.map((item) =>
        item.tmdbId === tmdbId ? { ...item, userSeason: newUserSeason || '0' } : item // Default to '0' if empty
    );
    setItemList(updatedList);
    debouncedSave(updatedList);
  };

   const updateRating = (tmdbId: number, newRating: number) => {
        const updatedList = itemList.map((item) =>
            item.tmdbId === tmdbId ? { ...item, rating: newRating } : item
        );
        setItemList(updatedList);
        debouncedSave(updatedList);
    };

  const deleteItem = (tmdbIdToDelete: number) => {
    const itemToDelete = itemList.find(item => item.tmdbId === tmdbIdToDelete);
    console.log(`Deleting item: ${itemToDelete?.title} (ID: ${tmdbIdToDelete})`);
    const updatedList = itemList.filter((item) => item.tmdbId !== tmdbIdToDelete);
    setItemList(updatedList);
    toast({
      title: 'Elemento Eliminado',
      description: `"${itemToDelete?.title || 'Elemento'}" ha sido eliminado.`,
    });
    debouncedSave(updatedList);
  };

  // --- Update Latest Seasons ---
  const handleUpdateItems = async () => { // Renamed function
    const itemsToUpdate = itemList.filter(item => item.type === 'series');
     if (itemsToUpdate.length === 0) {
       toast({ title: "Info", description: "No hay series en la lista para actualizar." });
       return;
    }
    console.log(`Updating ${itemsToUpdate.length} series from TMDb...`);
    setIsUpdatingAll(true);
    setItemList(prevList => prevList.map(item =>
        item.type === 'series' ? { ...item, loadingUpdate: true, errorUpdate: undefined } : item
    ));

    try {
      const { updatedList: serverUpdatedList, errors } = await updateItemsFromTmdbAction(); // Use renamed action
      console.log("Received from server after update:", serverUpdatedList); // Log received data

      // *** CORRECTED STATE UPDATE ***
      // Update local state ONCE with the results from the server and handle errors
      setItemList(serverUpdatedList.map(serverItem => {
          // Find if there's an error reported for this specific item
          const errorInfo = errors.find(e => e.title.includes(`ID ${serverItem.tmdbId}`) || e.title === serverItem.title);
          return {
              ...serverItem, // Spread ALL fields from the server response (preserves posterPath, etc.)
              loadingUpdate: false, // Reset loading flag
              errorUpdate: errorInfo ? errorInfo.error : undefined, // Assign error if exists
          };
      }));

      // Show toasts AFTER state update
      if (errors.length > 0) {
        console.warn("Errors during update:", errors);
        toast({
          title: `Actualización parcial (${errors.length} errores)`,
          description: `No se pudieron actualizar algunas series. Ver consola para detalles.`,
          variant: 'warning',
          duration: 5000,
        });
      } else {
        toast({
          title: 'Actualización Completa',
          description: 'Datos de TMDb actualizados correctamente.',
        });
      }

    } catch (error: any) {
        console.error("Error calling updateItemsFromTmdbAction:", error);
        toast({
            title: 'Error al Actualizar',
            description: `Ocurrió un error inesperado: ${error.message}`,
            variant: 'destructive',
        });
       setItemList(prevList => prevList.map(item => ({ ...item, loadingUpdate: false }))); // Reset loading on general failure
    } finally {
      setIsUpdatingAll(false);
    }
  };


  // --- Filtering and Sorting Logic ---
  const filteredAndSortedItemList = useMemo(() => { // Renamed variable
    let filteredList = itemList;

    if (searchTerm.trim() !== '') {
      filteredList = itemList.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const [key, order] = sortCriteria.split('-') as [SortKey | 'default', SortOrder | undefined];

    // Default sort or invalid criteria defaults to Title Asc
    if (key === 'default' || !order || (key !== 'title' && key !== 'rating')) {
         return [...filteredList].sort((a, b) => a.title.localeCompare(b.title));
    }

    return [...filteredList].sort((a, b) => { // Create a copy before sorting
      let comparison = 0;
      if (key === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (key === 'rating') {
        comparison = (a.rating ?? 0) - (b.rating ?? 0);
      }
      return order === 'asc' ? comparison : -comparison;
    });
  }, [itemList, searchTerm, sortCriteria]);


  // --- Render Logic ---
  if (isLoadingList) {
    return (
        <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Cargando lista...</p>
        </div>
    );
  }

  // Helper to get TMDb image URL
  const getTmdbImageUrl = (filePath: string | null | undefined, size: string = "w342") => {
      // Basic placeholder
      const placeholder = 'https://placehold.co/342x513/e2e8f0/718096?text=No+Imagen';
      if (!filePath) {
          // console.log("getTmdbImageUrl received null/undefined filePath"); // Log if path is missing
          return placeholder;
        }
      // console.log(`Generating image URL for path: ${filePath}`); // Log the path being used
      return `https://image.tmdb.org/t/p/${size}${filePath}`;
  }

  return (
      <div className="container mx-auto p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-8 text-center tracking-tight">Tracker Películas/Series</h1>

        {/* --- Controls Row --- */}
        <div className="mb-8 p-4 border rounded-lg bg-card shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Add Item Button (Opens Dialog) */}
                <div className="md:col-span-3">
                    <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full md:w-auto">
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Añadir Película/Serie...
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[650px]">
                            <DialogHeader>
                                <DialogTitle>Buscar en TMDb</DialogTitle>
                                <DialogDescription>
                                    Busca una película o serie para añadir a tu lista.
                                </DialogDescription>
                            </DialogHeader>
                            {/* Search Input and Button */}
                            <div className="flex space-x-2 my-4">
                                <Input
                                    placeholder="Buscar título..."
                                    value={tmdbSearchQuery}
                                    onChange={(e) => setTmdbSearchQuery(e.target.value)}
                                     onKeyDown={(e) => { if (e.key === 'Enter') handleTmdbSearch(); }}
                                />
                                <Button onClick={handleTmdbSearch} disabled={isSearchingTmdb || !tmdbSearchQuery.trim()} className="min-w-[100px]">
                                    {isSearchingTmdb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    <span className="ml-2">Buscar</span>
                                </Button>
                            </div>
                            {/* Search Results Area */}
                            <ScrollArea className="h-[400px] border rounded-md">
                                <div className="p-2 space-y-1">
                                    {/* Loading State */}
                                    {isSearchingTmdb && (
                                        <div className="flex justify-center items-center h-full py-10">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <p className="ml-2 text-muted-foreground">Buscando...</p>
                                        </div>
                                    )}
                                    {/* Error State */}
                                    {tmdbSearchError && !isSearchingTmdb && (
                                        <p className="text-center text-red-600 py-10 px-4">{tmdbSearchError}</p>
                                    )}
                                    {/* Results List */}
                                    {!isSearchingTmdb && tmdbSearchResults.map((result) => {
                                        const title = result.title || result.name || 'Desconocido';
                                        const year = result.release_date?.substring(0, 4) || result.first_air_date?.substring(0, 4);
                                        const typeText = result.media_type === 'tv' ? 'Serie' : 'Película';
                                        const alreadyExists = itemList.some(item => item.tmdbId === result.id);

                                        return (
                                            <div key={result.id}
                                                className={`flex items-start space-x-3 p-2 rounded transition-colors duration-150 ${alreadyExists ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground cursor-pointer'}`}
                                                onClick={() => !alreadyExists && handleAddItemFromTmdb(result)}
                                                title={alreadyExists ? `${title} ya está en tu lista` : `Añadir ${title}`}
                                            >
                                                 <img
                                                    src={getTmdbImageUrl(result.poster_path, "w92")}
                                                    alt={`Poster de ${title}`}
                                                    className="h-20 w-[53px] rounded object-cover flex-shrink-0 bg-muted border" // Fixed width based on aspect ratio
                                                    loading="lazy"
                                                    onError={(e) => (e.currentTarget.src = 'https://placehold.co/53x80/e2e8f0/718096?text=N/A')} // Adjusted placeholder size
                                                />
                                                <div className="flex-grow overflow-hidden pt-1">
                                                    <p className="font-semibold truncate text-sm">{title} {year ? `(${year})` : ''}</p>
                                                    <p className="text-xs text-muted-foreground">{typeText}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{result.overview || 'Sin descripción.'}</p> {/* Limit overview lines */}
                                                </div>
                                                {alreadyExists && <span className="text-xs text-muted-foreground ml-auto mr-2 flex-shrink-0">(Añadido)</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                            <DialogFooter className="mt-4">
                                 <DialogClose asChild>
                                     <Button type="button" variant="outline">Cerrar</Button>
                                 </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                 {/* Search Filter */}
                 <div className="relative">
                     <Label htmlFor="search-filter" className="mb-1 block text-sm font-medium">Filtrar Lista</Label>
                     <Search className="absolute left-2.5 bottom-2.5 h-4 w-4 text-muted-foreground" />
                     <Input
                        id="search-filter"
                        type="text"
                        placeholder="Filtrar por título..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                     />
                </div>

                {/* Sort Select */}
                 <div>
                     <Label htmlFor="sort-select" className="mb-1 block text-sm font-medium">Ordenar Por</Label>
                     <Select value={sortCriteria} onValueChange={setSortCriteria}>
                        <SelectTrigger id="sort-select" className="w-full">
                             <ArrowUpDown className="inline-block h-4 w-4 mr-2" />
                            <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                            {sortOptions.map(option => (
                                 <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                 {/* Update Button */}
                <Button
                    onClick={handleUpdateItems} // Renamed handler
                    disabled={isUpdatingAll || itemList.filter(i => i.type === 'series').length === 0}
                    className="w-full"
                    title={itemList.filter(i => i.type === 'series').length === 0 ? "Añade alguna serie primero" : "Buscar datos en TMDb (solo series)"}
                >
                    {isUpdatingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {isUpdatingAll ? 'Actualizando...' : 'Actualizar Datos'}
                </Button>
            </div>
        </div>


        {/* --- Display Item List --- */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"> {/* More responsive grid */}
          {filteredAndSortedItemList.length === 0 && !isLoadingList && (
              <p className="col-span-full text-center text-muted-foreground py-10">
                {searchTerm ? `No se encontraron resultados para "${searchTerm}".` : 'Tu lista está vacía. Usa el botón "+" para añadir películas o series.'}
              </p>
          )}
          {filteredAndSortedItemList.map((item) => (
              <Card key={item.tmdbId} className={`flex flex-col overflow-hidden transition-opacity duration-300 shadow-md hover:shadow-lg ${item.loadingUpdate ? 'opacity-60 animate-pulse' : ''}`}>
                {/* Loading overlay */}
                {item.loadingUpdate && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-30 rounded-lg">
                       <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
                 {/* Poster Image */}
                 <div className="relative aspect-[2/3] w-full bg-muted">
                     <img
                        // Use the helper function for the image URL
                        src={getTmdbImageUrl(item.posterPath, "w342")}
                        alt={`Poster de ${item.title}`}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        // Add error handling for the image itself
                        onError={(e) => {
                            console.warn(`Failed to load image for ${item.title}: ${e.currentTarget.src}`);
                            e.currentTarget.src = 'https://placehold.co/342x513/e2e8f0/718096?text=No+Imagen'; // Set placeholder on error
                            e.currentTarget.onerror = null; // Prevent infinite loop if placeholder also fails
                        }}
                     />
                     {/* Type Badge */}
                     <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs font-semibold backdrop-blur-sm z-10 flex items-center">
                          {item.type === 'movie' ? <Film className="h-3 w-3 mr-1" /> : <Tv className="h-3 w-3 mr-1" />}
                          {item.type === 'movie' ? 'Película' : 'Serie'} {item.releaseYear ? `(${item.releaseYear})` : ''}
                     </div>
                      {/* Delete Button */}
                      <Button
                          variant="destructive" // More visible delete
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7 text-white bg-black/50 hover:bg-red-600 rounded-full z-20 opacity-70 hover:opacity-100 transition-opacity"
                          onClick={() => deleteItem(item.tmdbId)}
                          aria-label={`Delete ${item.title}`}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                 </div>

                 {/* Content Below Poster */}
                 <div className="p-3 flex flex-col flex-grow">
                    <CardHeader className="p-0 pb-2">
                        <CardTitle className="text-sm font-semibold line-clamp-1" title={item.title}>{item.title}</CardTitle>
                       {item.type === 'series' && (
                           <CardDescription className="text-xs mt-0.5">
                             {item.errorUpdate ? (
                                 <span className="text-red-600 font-semibold">Error: {item.errorUpdate}</span>
                             ) : (
                                 <>
                                   Última Temp (TMDb): <span className="font-semibold text-primary">{item.latestSeason ?? 'N/A'}</span>
                                 </>
                             )}
                          </CardDescription>
                       )}
                    </CardHeader>
                    <CardContent className="p-0 space-y-3 flex-grow flex flex-col justify-between mt-auto"> {/* mt-auto pushes content down */}
                        {/* Rating */}
                       <div className="flex items-center justify-between mt-1">
                            <Label className="text-xs font-medium">Puntuación:</Label>
                            <StarRating
                                rating={item.rating}
                                onRatingChange={(newRating) => updateRating(item.tmdbId, newRating)}
                                size={4} // Slightly smaller stars
                            />
                       </div>
                       {/* User Season Input (only for Series) */}
                       {item.type === 'series' && (
                           <div>
                            <Label htmlFor={`user-season-${item.tmdbId}`} className="text-xs font-medium">Tu Temporada:</Label>
                            <Input
                                type="number"
                                min="0"
                                id={`user-season-${item.tmdbId}`}
                                value={item.userSeason}
                                onChange={(e) => updateUserSeason(item.tmdbId, e.target.value)}
                                className="mt-1 h-8 text-sm" // Smaller input
                                placeholder="e.g., 1"
                            />
                          </div>
                       )}
                       {/* Spacer for movies to align layout */}
                       {item.type === 'movie' && <div className="h-[56px]"></div>} {/* Adjust height to match series input+label approx */}
                    </CardContent>
                 </div>
              </Card>
          ))}
        </div>

      </div>
  );
}
