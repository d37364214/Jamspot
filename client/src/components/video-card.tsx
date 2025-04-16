import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Video } from "@shared/schema";
import { PlayIcon, Clock, Eye } from "lucide-react";

interface VideoCardProps {
  video: Video;
  onClick: () => void;
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  // Formater la durée si elle existe
  const formatDuration = (duration: string | null) => {
    if (!duration) return "";
    
    // Si c'est déjà au format MM:SS ou HH:MM:SS, le renvoyer tel quel
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) {
      return duration;
    }
    
    // Si c'est en secondes, convertir en MM:SS
    const seconds = parseInt(duration);
    if (!isNaN(seconds)) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return duration;
  };

  return (
    <Card 
      className="overflow-hidden border-zinc-700 bg-zinc-800 hover:border-primary/50 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-video relative group">
        <img 
          src={video.thumbnail || `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="rounded-full bg-primary/80 p-3">
            <PlayIcon className="h-6 w-6" />
          </div>
        </div>
        
        {/* Durée de la vidéo */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(video.duration)}
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-medium line-clamp-2">{video.title}</h3>
        {video.description && (
          <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{video.description}</p>
        )}
      </CardContent>
      
      {video.views !== null && video.views > 0 && (
        <CardFooter className="py-2 px-4 border-t border-zinc-700 flex items-center text-xs text-zinc-400">
          <Eye className="h-3 w-3 mr-1" />
          {video.views} vues
        </CardFooter>
      )}
    </Card>
  );
}