import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Video } from "@shared/schema";
import ReactPlayer from "react-player";

interface VideoPlayerProps {
  video: Video | null;
  onClose: () => void;
}

export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  if (!video) return null;

  return (
    <Dialog open={!!video} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <div className="aspect-video">
          <ReactPlayer
            url={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            width="100%"
            height="100%"
            controls
          />
        </div>
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">{video.title}</h2>
          <p className="text-muted-foreground">{video.description}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
