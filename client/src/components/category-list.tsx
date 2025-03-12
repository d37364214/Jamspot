import { Category } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CategoryListProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function CategoryList({ categories, selectedId, onSelect }: CategoryListProps) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      <Button
        variant={selectedId === null ? "default" : "outline"}
        onClick={() => onSelect(null)}
      >
        All Videos
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedId === category.id ? "default" : "outline"}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
