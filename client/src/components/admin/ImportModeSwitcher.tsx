
import { Button } from "@/components/ui/button";
import { FileUpIcon, RssIcon } from "lucide-react";

interface ImportModeSwitcherProps {
  mode: 'manual' | 'auto';
  onChange: (mode: 'manual' | 'auto') => void;
}

export function ImportModeSwitcher({ mode, onChange }: ImportModeSwitcherProps) {
  return (
    <div className="flex gap-2 mb-6">
      <Button
        variant={mode === 'manual' ? 'default' : 'outline'}
        onClick={() => onChange('manual')}
      >
        <FileUpIcon className="h-4 w-4 mr-2" />
        Importation manuelle
      </Button>
      <Button
        variant={mode === 'auto' ? 'default' : 'outline'}
        onClick={() => onChange('auto')}
      >
        <RssIcon className="h-4 w-4 mr-2" />
        Importation automatique
      </Button>
    </div>
  );
}
