"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
    loadItemsAction,
    saveItemsAction,
    searchTmdbAction,
    updateItemsFromTmdbAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/ui/star-rating";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// --- Data Structures (matching actions.ts) ---
type ItemType = "movie" | "series";

interface StoredItemInfo {
    tmdbId: number;
    title: string;
    type: ItemType;
    latestSeason: number | null;
    userSeason: string;
    userEpisode: string;
    rating: number;
    posterPath?: string | null;
    releaseYear?: string | null;
}

interface TmdbSearchResult {
    id: number;
    title?: string;
    name?: string;
    media_type: "movie" | "tv";
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    overview?: string;
}

// --- Sorting Options ---
type SortKey = "title" | "rating";
type SortDirection = "asc" | "desc";
interface SortOption {
    value: `${SortKey}-${SortDirection}`;
    label: string;
}

const sortOptions: SortOption[] = [
    { value: "title-asc", label: "Título (A-Z)" },
    { value: "title-desc", label: "Título (Z-A)" },
    { value: "rating-desc", label: "Valoración (Mayor a Menor)" },
    { value: "rating-asc", label: "Valoración (Menor a Mayor)" },
];

// --- Recommendation Structure ---
interface RecommendationResult {
    title: string;
    reason?: string;
}

// --- Main Page Component ---
export default function TrackerPage() {
    const [itemList, setItemList] = useState<StoredItemInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false); // Keep for potential immediate saves like delete? Maybe not needed now.
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<TmdbSearchResult[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [sortCriteria, setSortCriteria] = useState<SortOption["value"]>("title-asc");
    const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
    const [isRecommendationsDialogOpen, setIsRecommendationsDialogOpen] = useState(false);
    const [recommendationError, setRecommendationError] = useState<string | null>(null);


    const { toast } = useToast();

    // --- Load Initial Data ---
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            try {
                const loadedItems = await loadItemsAction();
                setItemList(loadedItems);
            } catch (error) {
                console.error("Error loading items:", error);
                toast({
                    title: "Error",
                    description: "No se pudieron cargar los elementos.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [toast]);

    // --- Save Data ---
    // Debounced save function for frequent changes (rating, season, episode, add, delete)
    const debouncedSave = useCallback(
        debounce(async (items: StoredItemInfo[]) => {
            console.log("Debounced save triggered with items:", items); // Add log
            try {
                const result = await saveItemsAction(items);
                if (!result.success) {
                    throw new Error("Debounced save operation failed");
                }
                console.log("Items saved via debounce."); // Log for clarity
            } catch (error) {
                console.error("Error saving items via debounce:", error);
                toast({
                    title: "Error de Guardado Automático",
                    description: "No se pudieron guardar los últimos cambios.",
                    variant: "destructive",
                });
            }
        }, 1500),
        [toast] // Dependency array only includes toast
    );

    // --- Event Handlers ---

    const handleRatingChange = (tmdbId: number, newRating: number) => {
        setItemList((prevList) => {
            const newList = prevList.map((item) =>
                item.tmdbId === tmdbId ? { ...item, rating: newRating } : item
            );
            debouncedSave(newList); // Use debounced save
            return newList;
        });
    };

    const handleSeasonChange = (tmdbId: number, newSeason: string) => {
        setItemList((prevList) => {
            const newList = prevList.map((item) =>
                item.tmdbId === tmdbId ? { ...item, userSeason: newSeason } : item
            );
            debouncedSave(newList); // Use debounced save
            return newList;
        });
    };

    const handleEpisodeChange = (tmdbId: number, newEpisode: string) => {
        setItemList((prevList) => {
            const newList = prevList.map((item) =>
                item.tmdbId === tmdbId ? { ...item, userEpisode: newEpisode } : item
            );
            debouncedSave(newList); // Use debounced save
            return newList;
        });
    };

    // --- MODIFIED handleDeleteItem ---
    const handleDeleteItem = (tmdbId: number) => {
        let deletedItemTitle = "Elemento"; // Default title
        let newList: StoredItemInfo[] = []; // Define newList outside setItemList

        setItemList((prevList) => {
            const itemToDelete = prevList.find(item => item.tmdbId === tmdbId);
            if (itemToDelete) {
                deletedItemTitle = `"${itemToDelete.title}"`;
            }
            newList = prevList.filter((item) => item.tmdbId !== tmdbId); // Assign inside
            // saveImmediately(newList); // <-- REMOVE THIS
            return newList; // Update local state immediately
        });

        // Use debounced save instead of immediate save
        debouncedSave(newList);

        toast({ title: "Elemento eliminado", description: `${deletedItemTitle} se ha quitado de tu lista.` });
    };
    // --- End MODIFIED handleDeleteItem ---

    const handleSearchTmdb = async () => {
        if (!searchQuery.trim()) {
            setSearchError("Introduce un título para buscar.");
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        setSearchError(null);
        setSearchResults([]);
        try {
            const { results, error } = await searchTmdbAction(searchQuery);
            if (error) {
                setSearchError(error);
            } else {
                setSearchResults(results);
                if (results.length === 0) {
                    setSearchError("No se encontraron resultados para tu búsqueda.");
                }
            }
        } catch (error: any) {
            console.error("Error during TMDb search action:", error);
            setSearchError(error.message || "Error desconocido durante la búsqueda.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddItem = (result: TmdbSearchResult) => {
        if (itemList.some(item => item.tmdbId === result.id)) {
            toast({ title: "Duplicado", description: "Este elemento ya está en tu lista.", variant: "default" });
            return;
        }

        const newItem: StoredItemInfo = {
            tmdbId: result.id,
            title: result.title || result.name || "Título Desconocido",
            type: result.media_type === 'tv' ? 'series' : 'movie',
            latestSeason: null,
            userSeason: '0',
            userEpisode: '0',
            rating: 0,
            posterPath: result.poster_path,
            releaseYear: result.release_date?.substring(0, 4) || result.first_air_date?.substring(0, 4) || null,
        };

        let newList: StoredItemInfo[] = []; // Define newList outside setItemList
        setItemList((prevList) => {
            newList = [...prevList, newItem]; // Assign inside to get latest state
            return newList; // Update local state immediately
        });

        // Use debounced save instead of immediate save
        debouncedSave(newList);

        toast({ title: "Añadido", description: `"${newItem.title}" se ha añadido a tu lista.` });

        // These state updates are generally safe after the primary list update
        setIsSearchDialogOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        setSearchError(null);
    };


    const handleUpdateData = async () => {
        setIsUpdating(true);
        toast({ title: "Actualizando...", description: "Obteniendo datos de TMDb..." });
        try {
            const { updatedList, errors } = await updateItemsFromTmdbAction();
            setItemList(updatedList);
            if (errors.length > 0) {
                errors.forEach(err => {
                    toast({ title: `Error al actualizar "${err.title}"`, description: err.error, variant: "destructive" });
                });
            } else {
                toast({ title: "Datos Actualizados", description: "Información de temporadas actualizada." });
            }
        } catch (error: any) {
            console.error("Error updating data from TMDb:", error);
            toast({
                title: "Error de Actualización",
                description: error.message || "No se pudieron actualizar los datos desde TMDb.",
                variant: "destructive",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    // --- AI Recommendation Handler using fetch ---
    const handleGetRecommendations = async () => {
        setIsRecommending(true);
        setRecommendations([]);
        setRecommendationError(null);
        setIsRecommendationsDialogOpen(true);

        // Prepare data for the API call
        const ratedSeriesForAI = itemList
            .filter(item => item.rating > 0)
            .map(item => ({
                title: item.title,
                rating: item.rating,
            }));

        const excludeTitles = itemList.map(item => item.title);

        if (ratedSeriesForAI.length === 0) {
            setRecommendationError("No has valorado ninguna serie o película todavía. ¡Valora algunas para obtener recomendaciones!");
            setIsRecommending(false);
            return;
        }

        try {
            // Call the new API route
            const response = await fetch('/api/recommendations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: {
                        ratedSeries: ratedSeriesForAI,
                        excludeTitles: excludeTitles,
                        count: 5,
                    }
                }),
            });

            // Check for HTTP errors first
            if (!response.ok) {
                let errorMsg = `Error del servidor: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error?.message || errorMsg;
                } catch (parseError) { /* Ignore */ }
                console.error("Recommendation API error response:", response.status, errorMsg);
                throw new Error(errorMsg);
            }

            // Parse the successful JSON response
            const result = await response.json();

            // Check response structure
            if (!result || !Array.isArray(result.recommendations)) {
                if (result.message) {
                    setRecommendationError(result.message);
                    setIsRecommending(false);
                    return;
                }
                console.error("Invalid response structure from API:", result);
                throw new Error("La respuesta de la API no tuvo el formato esperado.");
            }

            // Set the recommendations
            setRecommendations(result.recommendations);

        } catch (err: any) {
            console.error("Error fetching recommendations:", err);
            setRecommendationError(err.message || "Ocurrió un error inesperado al obtener recomendaciones.");
        } finally {
            setIsRecommending(false);
        }
    };


    // --- Filtering and Sorting Logic ---
    const filteredAndSortedList = useMemo(() => {
        const [key, direction] = sortCriteria.split("-") as [SortKey, SortDirection];

        const filtered = itemList.filter((item) =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            let compareA: string | number;
            let compareB: string | number;

            if (key === "title") {
                compareA = a.title.toLowerCase();
                compareB = b.title.toLowerCase();
            } else { // key === 'rating'
                compareA = a.rating;
                compareB = b.rating;
            }

            if (compareA < compareB) {
                return direction === "asc" ? -1 : 1;
            }
            if (compareA > compareB) {
                return direction === "asc" ? 1 : -1;
            }
            return 0;
        });
    }, [itemList, searchTerm, sortCriteria]);

    // --- Render ---
    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Mi Lista de Películas y Series</h1>

            {/* --- Controls --- */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
                <Input
                    type="text"
                    placeholder="Filtrar por título..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-grow"
                />
                <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto justify-center"> {/* Added flex-wrap and justify-center */}
                    <Select value={sortCriteria} onValueChange={(value: SortOption["value"]) => setSortCriteria(value)}>
                        <SelectTrigger className="w-full sm:w-[180px] md:w-[200px]"> {/* Responsive width */}
                            <SelectValue placeholder="Ordenar Por" />
                        </SelectTrigger>
                        <SelectContent>
                            {sortOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleUpdateData} disabled={isUpdating} variant="outline" className="w-auto flex-grow sm:flex-grow-0"> {/* Adjusted width */}
                        {isUpdating ? <Icons.loader className="mr-2 h-4 w-4 animate-spin" /> : <Icons.refreshCw className="mr-2 h-4 w-4" />}
                        Actualizar Datos
                    </Button>
                    <Button onClick={handleGetRecommendations} disabled={isRecommending || isLoading} variant="outline" className="w-auto flex-grow sm:flex-grow-0 bg-blue-600 hover:bg-blue-700 text-white"> {/* Adjusted width */}
                        {isRecommending ? <Icons.loader className="mr-2 h-4 w-4 animate-spin" /> : <Icons.wand className="mr-2 h-4 w-4" />}
                        Recomiéndame
                    </Button>
                    <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-auto flex-grow sm:flex-grow-0"> {/* Adjusted width */}
                                <Icons.plus className="mr-2 h-4 w-4" /> Añadir...
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[625px]">
                            <DialogHeader>
                                <DialogTitle>Buscar y Añadir Película/Serie</DialogTitle>
                                <DialogDescription>
                                    Busca en TMDb y añade elementos a tu lista.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex gap-2 my-4">
                                <Input
                                    placeholder="Buscar título en TMDb..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchTmdb()}
                                />
                                <Button onClick={handleSearchTmdb} disabled={isSearching}>
                                    {isSearching ? <Icons.loader className="mr-2 h-4 w-4 animate-spin" /> : <Icons.search className="mr-2 h-4 w-4" />}
                                    Buscar
                                </Button>
                            </div>
                            {searchError && <Alert variant="destructive"><AlertDescription>{searchError}</AlertDescription></Alert>}
                            <ScrollArea className="h-[400px] mt-4">
                                {searchResults.length > 0 && (
                                    <div className="space-y-4">
                                        {searchResults.map((result) => (
                                            <Card key={result.id} className="flex items-center p-3 gap-4">
                                                <img
                                                    src={result.poster_path ? `https://image.tmdb.org/t/p/w92${result.poster_path}` : "https://placehold.co/92x138/666/fff?text=N/A"}
                                                    alt={`Poster de ${result.title || result.name}`}
                                                    className="w-[60px] h-[90px] object-cover rounded-sm flex-shrink-0 bg-muted"
                                                    onError={(e) => (e.currentTarget.src = "https://placehold.co/92x138/666/fff?text=Error")}
                                                />
                                                <div className="flex-grow">
                                                    <p className="font-semibold">{result.title || result.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {result.media_type === 'movie' ? 'Película' : 'Serie'}
                                                        {` (${result.release_date?.substring(0, 4) || result.first_air_date?.substring(0, 4) || 'N/A'})`}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.overview}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAddItem(result)}
                                                    disabled={itemList.some(item => item.tmdbId === result.id)}
                                                >
                                                    {itemList.some(item => item.tmdbId === result.id) ? <Icons.check className="mr-2 h-4 w-4" /> : <Icons.plus className="mr-2 h-4 w-4" />}
                                                    {itemList.some(item => item.tmdbId === result.id) ? 'Añadido' : 'Añadir'}
                                                </Button>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* --- Item List --- */}
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Icons.loader className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredAndSortedList.length === 0 ? (
                <p className="text-center text-muted-foreground mt-10">
                    {searchTerm ? "No se encontraron elementos que coincidan con tu filtro." : "Tu lista está vacía. ¡Añade alguna película o serie!"}
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredAndSortedList.map((item) => (
                        <Card key={item.tmdbId} className="flex flex-col">
                            <CardHeader className="p-0 relative">
                                <img
                                    src={item.posterPath ? `https://image.tmdb.org/t/p/w342${item.posterPath}` : "https://placehold.co/342x513/666/fff?text=N/A"}
                                    alt={`Poster de ${item.title}`}
                                    className="w-full h-auto object-cover rounded-t-lg aspect-[2/3] bg-muted"
                                    onError={(e) => (e.currentTarget.src = "https://placehold.co/342x513/666/fff?text=Error")}
                                    loading="lazy"
                                />
                                <Badge variant={item.type === 'series' ? 'secondary' : 'outline'} className="absolute top-2 right-2">
                                    {item.type === 'series' ? 'Serie' : 'Película'}
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-4 flex-grow flex flex-col justify-between">
                                <div>
                                    <CardTitle className="text-lg mb-1 line-clamp-2">{item.title}</CardTitle>
                                    {item.releaseYear && (
                                        <CardDescription className="text-xs mb-2">{item.releaseYear}</CardDescription>
                                    )}
                                    <div className="mb-3">
                                        <StarRating
                                            rating={item.rating}
                                            onRatingChange={(newRating) => handleRatingChange(item.tmdbId, newRating)}
                                            size={22}
                                        />
                                    </div>
                                </div>
                                {item.type === 'series' && (
                                    <div className="mt-auto space-y-2">
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={`season-${item.tmdbId}`} className="text-sm font-medium whitespace-nowrap">Tu Temporada:</label>
                                            <Input
                                                id={`season-${item.tmdbId}`}
                                                type="number"
                                                min="0"
                                                value={item.userSeason}
                                                onChange={(e) => handleSeasonChange(item.tmdbId, e.target.value)}
                                                className="h-8 w-16 text-center"
                                                placeholder="S"
                                            />
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {item.latestSeason !== null ? `/ ${item.latestSeason}` : ''}
                      </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={`episode-${item.tmdbId}`} className="text-sm font-medium whitespace-nowrap">Tu Episodio:</label>
                                            <Input
                                                id={`episode-${item.tmdbId}`}
                                                type="number"
                                                min="0"
                                                value={item.userEpisode}
                                                onChange={(e) => handleEpisodeChange(item.tmdbId, e.target.value)}
                                                className="h-8 w-16 text-center"
                                                placeholder="E"
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="p-3 border-t">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(item.tmdbId)}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    aria-label={`Eliminar ${item.title}`}
                                >
                                    <Icons.trash className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" asChild className="ml-auto">
                                    <a
                                        href={`https://www.themoviedb.org/${item.type === 'series' ? 'tv' : 'movie'}/${item.tmdbId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Ver ${item.title} en TMDb`}
                                    >
                                        <Icons.externalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* --- Recommendations Dialog --- */}
            <Dialog open={isRecommendationsDialogOpen} onOpenChange={setIsRecommendationsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Recomendaciones para ti</DialogTitle>
                        <DialogDescription>
                            Basado en tus valoraciones, aquí tienes algunas series que podrían gustarte.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isRecommending ? (
                            <div className="flex justify-center items-center h-20">
                                <Icons.loader className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : recommendationError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{recommendationError}</AlertDescription>
                            </Alert>
                        ) : recommendations.length > 0 ? (
                            <ul className="space-y-3">
                                {recommendations.map((rec, index) => (
                                    <li key={index} className="border-b pb-2 last:border-b-0">
                                        <p className="font-semibold">{rec.title}</p>
                                        {rec.reason && (
                                            <p className="text-sm text-muted-foreground italic">"{rec.reason}"</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-muted-foreground">No hay recomendaciones disponibles.</p> // Handles empty recommendations array
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cerrar
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// --- Debounce Utility ---
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): Promise<ReturnType<F>> => {
        return new Promise((resolve) => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                timeoutId = null;
                resolve(func(...args));
            }, waitFor);
        });
    };
}

