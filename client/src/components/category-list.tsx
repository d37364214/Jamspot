import { Button } from "@/components/ui/button";
import { FolderIcon } from "lucide-react";
import { Category } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CategoryListProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function CategoryList({ categories, selectedId, onSelect }: CategoryListProps) {
  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start",
          selectedId === null && "bg-primary/10 text-primary hover:bg-primary/20"
        )}
        onClick={() => onSelect(null)}
      >
        <FolderIcon className="mr-2 h-4 w-4" />
        Toutes les catégories
      </Button>
      
      {categories.map((category) => (
        <Button
          key={category.id}
          variant="ghost"
          className={cn(
            "w-full justify-start",
            selectedId === category.id && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          onClick={() => onSelect(category.id)}
        >
          <FolderIcon className="mr-2 h-4 w-4" />
          {category.name}
        </Button>
      ))}
    </div>
  );
}