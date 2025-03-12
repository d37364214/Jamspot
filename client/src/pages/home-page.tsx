import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Video, Category } from "@shared/schema";
import { VideoCard } from "@/components/video-card";
import { VideoPlayer } from "@/components/video-player";
import { CategoryList } from "@/components/category-list";

export default function HomePage() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ["/api/videos", selectedCategory],
  });

  const filteredVideos = selectedCategory
    ? videos.filter((v) => v.categoryId === selectedCategory)
    : videos;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Music Videos</h1>
        
        <CategoryList
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => setSelectedVideo(video)}
            />
          ))}
        </div>

        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      </div>
    </div>
  );
}
