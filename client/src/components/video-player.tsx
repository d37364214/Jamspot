import { useEffect, useRef } from "react";
import { Video } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import ReactPlayer from "react-player";

interface VideoPlayerProps {
  video: Video | null;
  onClose: () => void;
}

export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  
  // Gérer les touches du clavier (échap pour fermer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  
  if (!video) return null;
  
  return (
    <Dialog open={!!video} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-zinc-900">
        <div className="absolute top-2 right-2 z-50">
          <button
            onClick={onClose}
            className="rounded-full bg-black/70 p-2 hover:bg-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="aspect-video w-full bg-black">
          <ReactPlayer
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            width="100%"
            height="100%"
            controls
            playing
            config={{
              youtube: {
                playerVars: {
                  modestbranding: 1,
                  rel: 0
                }
              }
            }}
          />
        </div>
        
        <div className="p-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{video.title}</DialogTitle>
            {video.description && (
              <DialogDescription className="text-zinc-300 mt-2">
                {video.description}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>
      </DialogContent>
    </Dialog>
  );
}