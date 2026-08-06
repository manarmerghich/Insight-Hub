"use client";

import { useOptimistic, useState, useTransition } from "react";

import { toggleMessageFavorite } from "./actions";

export function FavoriteButton({
  messageId,
  initialIsFavorite,
}: {
  messageId: number;
  initialIsFavorite: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [optimisticIsFavorite, setOptimisticIsFavorite] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimisticIsFavorite;
    startTransition(async () => {
      setOptimisticIsFavorite(next);
      try {
        const persisted = await toggleMessageFavorite(messageId, next);
        startTransition(() => {
          setIsFavorite(persisted);
        });
      } catch {
        // Ne pas mettre à jour isFavorite : l'état optimiste revient à l'état
        // précédent une fois la transition terminée (voir message-favorites).
      }
    });
  }

  return (
    <button
      type="button"
      className={`favorite-button${optimisticIsFavorite ? " favorite-button--active" : ""}`}
      onClick={handleClick}
      aria-pressed={optimisticIsFavorite}
      aria-label={optimisticIsFavorite ? "Retirer des favoris" : "Marquer comme favori"}
      title={optimisticIsFavorite ? "Retirer des favoris" : "Marquer comme favori"}
    >
      {optimisticIsFavorite ? "★" : "☆"}
    </button>
  );
}
