'use client'; // Needed because it uses onClick client-side interaction

import * as React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils'; // Import cn for potential future styling consistency

// Interface for the component's props
interface StarRatingProps extends React.HTMLAttributes<HTMLDivElement> {
    rating: number;
    onRatingChange: (newRating: number) => void;
    size?: number; // Optional size prop for the stars
    readOnly?: boolean; // Optional prop to make it non-interactive
}

const StarRating = React.forwardRef<HTMLDivElement, StarRatingProps>(
    ({ rating, onRatingChange, className, size = 5, readOnly = false, ...props }, ref) => {
        const handleStarClick = (starValue: number) => {
            if (!readOnly) {
                // If clicking the current rating star again, set rating to 0, otherwise set to starValue
                // onRatingChange(starValue === rating ? 0 : starValue);
                // Or simpler: always set to the clicked star value (1-5)
                onRatingChange(starValue);
            }
        };

        return (
            <div
                ref={ref}
                className={cn('flex items-center space-x-1', className)} // Use cn for merging classes
                {...props}
            >
                {[1, 2, 3, 4, 5].map((starValue) => (
                    <Star
                        key={starValue}
                        className={cn(
                            'cursor-pointer transition-colors duration-150 ease-in-out',
                            `h-${size} w-${size}`, // Apply dynamic size
                            starValue <= rating
                                ? 'text-yellow-400 fill-yellow-400' // Filled star style
                                : 'text-muted-foreground hover:text-yellow-300', // Empty star style with hover effect
                            readOnly ? 'cursor-default hover:text-muted-foreground' : '' // Adjust cursor and hover if readOnly
                        )}
                        onClick={() => handleStarClick(starValue)}
                        aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
                    />
                ))}
            </div>
        );
    }
);

StarRating.displayName = 'StarRating'; // Assign display name like other UI components

export { StarRating }; // Export the component
