"use client";

import * as React from "react";
import { Star } from "lucide-react"; // Only need the full Star icon now
import { cn } from "@/lib/utils";

interface StarRatingProps extends React.HTMLAttributes<HTMLDivElement> {
    rating: number; // Can now be a decimal (e.g., 3.5)
    totalStars?: number;
    size?: number;
    fillColor?: string; // e.g., "text-yellow-500"
    emptyColor?: string; // e.g., "text-gray-400"
    onRatingChange?: (rating: number) => void; // Callback function for rating change
    disabled?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
                                                   rating: currentRating,
                                                   totalStars = 5,
                                                   size = 20,
                                                   fillColor = "text-yellow-500", // Default fill color
                                                   emptyColor = "text-gray-300", // Default empty color (slightly lighter)
                                                   onRatingChange,
                                                   disabled = false,
                                                   className,
                                                   ...props
                                               }) => {
    const [hoverRating, setHoverRating] = React.useState<number | null>(null);

    const handleMouseMove = (event: React.MouseEvent<HTMLSpanElement>, index: number) => {
        if (disabled || !onRatingChange) return;
        const starElement = event.currentTarget;
        const rect = starElement.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element.
        const isHalf = x < rect.width / 2;
        const newHoverRating = isHalf ? index + 0.5 : index + 1;
        setHoverRating(newHoverRating);
    };

    const handleMouseLeave = () => {
        if (disabled || !onRatingChange) return;
        setHoverRating(null);
    };

    const handleClick = (event: React.MouseEvent<HTMLSpanElement>, index: number) => {
        if (disabled || !onRatingChange) return;
        const starElement = event.currentTarget;
        const rect = starElement.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element.
        const isHalf = x < rect.width / 2;
        const newRating = isHalf ? index + 0.5 : index + 1;

        // Allow unsetting the rating
        if ((newRating === 0.5 && currentRating === 0.5) || (newRating === 1 && currentRating === 1)) {
            onRatingChange(0);
        } else {
            onRatingChange(newRating);
        }
    };

    const ratingToDisplay = hoverRating ?? currentRating;

    return (
        <div
            className={cn("flex items-center space-x-0.5", className, { // Reduced space for better half-star look
                "cursor-pointer": !disabled && onRatingChange,
                "cursor-not-allowed opacity-60": disabled
            })}
            onMouseLeave={handleMouseLeave}
            title={`Valoración: ${currentRating} de ${totalStars}`} // Add tooltip
            {...props}
        >
            {[...Array(totalStars)].map((_, i) => {
                const starValue = i + 1;
                const isFullStar = ratingToDisplay >= starValue;
                // Check if the star should be the half-filled one
                const isHalfStar = ratingToDisplay > i && ratingToDisplay < starValue;

                const starClasses = cn(
                    "transition-colors duration-150 ease-in-out",
                    isFullStar || isHalfStar ? fillColor : emptyColor, // Apply fill color based on state
                    hoverRating !== null && (starValue <= hoverRating || (hoverRating > i && hoverRating < starValue)) ? 'opacity-80 scale-110' : 'opacity-100 scale-100', // Hover effect
                );

                return (
                    <span
                        key={i}
                        className="relative inline-block" // Use span as container
                        style={{ width: size, height: size }} // Ensure container has size
                        onMouseMove={(e) => handleMouseMove(e, i)}
                        onClick={(e) => handleClick(e, i)}
                    >
            {/* Background Empty Star (always present) */}
                        <Star
                            className={cn("absolute inset-0", emptyColor)}
                            size={size}
                            fill="currentColor" // Fill the background empty star with its color
                            strokeWidth={1.5} // Optional: adjust stroke
                        />
                        {/* Filled Star (selectively clipped) */}
                        {(isFullStar || isHalfStar) && (
                            <span
                                className="absolute inset-0 overflow-hidden" // Container for clipping
                                style={{
                                    clipPath: isHalfStar ? `inset(0 50% 0 0)` : undefined, // Clip right half for half stars
                                }}
                            >
                <Star
                    className={starClasses} // Apply dynamic classes here
                    size={size}
                    fill="currentColor" // Fill the foreground star
                    strokeWidth={1.5} // Optional: adjust stroke
                />
              </span>
                        )}
          </span>
                );
            })}
        </div>
    );
};

export { StarRating };
