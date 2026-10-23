import * as React from "react";
import { Movie } from "@/types/movie";
import { MovieCard } from "./movie-card";

interface MovieGridProps {
  movies: Movie[];
  className?: string;
  showProgress?: boolean;
}

export const MovieGrid = React.memo(function MovieGrid({ movies, className, showProgress }: MovieGridProps) {
  if (!movies || movies.length === 0) return null;

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4 md:gap-5 ${
        className || ""
      }`}
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          priority={index < 6}
          showProgress={showProgress}
        />
      ))}
    </div>
  );
});
