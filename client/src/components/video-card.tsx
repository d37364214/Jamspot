import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "@shared/schema";

interface VideoCardProps {
  video: Video;
  onClick: () => void;
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow" 
      onClick={onClick}
    >
      <CardHeader className="p-4">
        <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <img 
          src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
          alt={video.title}
          className="w-full aspect-video object-cover rounded-md"
        />
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {video.description}
        </p>
      </CardContent>
    </Card>
  );
}
