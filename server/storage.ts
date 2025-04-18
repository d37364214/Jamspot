import { 
  User, InsertUser, 
  Category, InsertCategory, 
  Video, InsertVideo,
  Subcategory, InsertSubcategory,
  Tag, InsertTag,
  ActivityLog, InsertActivityLog,
  VideoTag, InsertVideoTag
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { db } from "./db";
import { 
  users, categories, videos, 
  subcategories, tags, videoTags, 
  activityLogs
} from "@shared/schema";
import { eq, and, like, desc, sql, asc } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin?: boolean }): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Videos
  getVideos(): Promise<Video[]>;
  getVideosByCategory(categoryId: number): Promise<Video[]>;
  getVideosBySubcategory(subcategoryId: number): Promise<Video[]>;
  getVideosByTag(tagId: number): Promise<Video[]>;
  getVideo(id: number): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: number, data: Partial<InsertVideo>): Promise<Video | undefined>;
  deleteVideo(id: number): Promise<boolean>;
  searchVideos(query: string): Promise<Video[]>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Subcategories
  getSubcategories(): Promise<Subcategory[]>;
  getSubcategoriesByCategory(categoryId: number): Promise<Subcategory[]>;
  getSubcategory(id: number): Promise<Subcategory | undefined>;
  getSubcategoryBySlug(slug: string): Promise<Subcategory | undefined>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: number, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined>;
  deleteSubcategory(id: number): Promise<boolean>;
  
  // Tags
  getTags(): Promise<Tag[]>;
  getTag(id: number): Promise<Tag | undefined>;
  getTagBySlug(slug: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, data: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<boolean>;
  
  // Video-Tag relations
  getVideoTags(videoId: number): Promise<Tag[]>;
  addTagToVideo(videoId: number, tagId: number): Promise<void>;
  removeTagFromVideo(videoId: number, tagId: number): Promise<void>;
  
  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit: number): Promise<ActivityLog[]>;
  getActivityLogsByUser(userId: number, limit: number): Promise<ActivityLog[]>;
  getActivityLogsByEntityType(entityType: string, limit: number): Promise<ActivityLog[]>;
  
  // Statistics
  getVideoCount(): Promise<number>;
  getCategoryCount(): Promise<number>;
  getTagCount(): Promise<number>;
  getUserCount(): Promise<number>;
  
  // Session
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // --------------------- User Management --------------------- //
  
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result?.[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result?.[0];
  }

  async createUser(insertUser: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const now = new Date().toISOString();
    const result = await db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      isAdmin: insertUser.isAdmin ?? false,
      createdAt: now,
    }).returning();
    return result?.[0];
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return result?.[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // --------------------- Video Management --------------------- //
  
  async getVideos(): Promise<Video[]> {
    return await db.select().from(videos).orderBy(desc(videos.createdAt));
  }
  
  async getVideosByCategory(categoryId: number): Promise<Video[]> {
    return await db.select()
      .from(videos)
      .where(eq(videos.categoryId, categoryId))
      .orderBy(desc(videos.createdAt));
  }
  
  async getVideosBySubcategory(subcategoryId: number): Promise<Video[]> {
    return await db.select()
      .from(videos)
      .where(eq(videos.subcategoryId, subcategoryId))
      .orderBy(desc(videos.createdAt));
  }
  
  async getVideo(id: number): Promise<Video | undefined> {
    const result = await db.select().from(videos).where(eq(videos.id, id));
    return result?.[0];
  }
  
  async getVideosByTag(tagId: number): Promise<Video[]> {
    // Cette requête renvoie un format différent, nous devons extraire les données vidéos
    const result = await db.select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      youtubeId: videos.youtubeId,
      categoryId: videos.categoryId,
      subcategoryId: videos.subcategoryId,
      thumbnail: videos.thumbnail,
      duration: videos.duration,
      createdAt: videos.createdAt,
      updatedAt: videos.updatedAt,
      views: videos.views
    })
      .from(videos)
      .innerJoin(videoTags, eq(videos.id, videoTags.videoId))
      .where(eq(videoTags.tagId, tagId))
      .orderBy(desc(videos.createdAt));
    
    return result;
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const now = new Date().toISOString();
    const result = await db.insert(videos).values({
      ...insertVideo,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result?.[0];
  }
  
  async updateVideo(id: number, data: Partial<InsertVideo>): Promise<Video | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(videos)
      .set({
        ...data,
        updatedAt: now
      })
      .where(eq(videos.id, id))
      .returning();
    return result?.[0];
  }
  
  async deleteVideo(id: number): Promise<boolean> {
    // First delete any video-tag relationships
    await db.delete(videoTags).where(eq(videoTags.videoId, id));
    
    // Then delete the video
    const result = await db.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }
  
  async searchVideos(query: string): Promise<Video[]> {
    return await db.select()
      .from(videos)
      .where(
        sql`(${videos.title} LIKE ${'%' + query + '%'} OR ${videos.description} LIKE ${'%' + query + '%'})`
      )
      .orderBy(desc(videos.createdAt));
  }

  // --------------------- Category Management --------------------- //
  
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }
  
  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.slug, slug));
    return result?.[0];
  }
  
  async getCategory(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result?.[0];
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const now = new Date().toISOString();
    const result = await db.insert(categories).values({
      ...insertCategory,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result?.[0];
  }
  
  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(categories)
      .set({
        ...data,
        updatedAt: now
      })
      .where(eq(categories.id, id))
      .returning();
    return result?.[0];
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    // First check if there are videos using this category
    const videosUsingCategory = await db.select({ count: sql`count(*)` })
      .from(videos)
      .where(eq(videos.categoryId, id));
    
    // Get count as number with ?? 0 (fallback if undefined)
    const videoCount = Number(videosUsingCategory?.[0]?.count ?? 0);
    if (videoCount > 0) {
      return false; // Cannot delete a category with videos
    }
    
    // Also check if there are subcategories
    const subcategoriesCount = await db.select({ count: sql`count(*)` })
      .from(subcategories)
      .where(eq(subcategories.categoryId, id));
    
    // Get count as number with ?? 0 (fallback if undefined)
    const subCatCount = Number(subcategoriesCount?.[0]?.count ?? 0);
    if (subCatCount > 0) {
      return false; // Cannot delete a category with subcategories
    }
    
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    // Ensure we're checking safely if array exists
    return Array.isArray(result) ? result.length > 0 : false;
  }
  
  // --------------------- Subcategory Management --------------------- //
  
  async getSubcategories(): Promise<Subcategory[]> {
    return await db.select().from(subcategories).orderBy(asc(subcategories.name));
  }
  
  async getSubcategoriesByCategory(categoryId: number): Promise<Subcategory[]> {
    return await db.select()
      .from(subcategories)
      .where(eq(subcategories.categoryId, categoryId))
      .orderBy(asc(subcategories.name));
  }
  
  async getSubcategory(id: number): Promise<Subcategory | undefined> {
    const result = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return result?.[0];
  }
  
  async getSubcategoryBySlug(slug: string): Promise<Subcategory | undefined> {
    const result = await db.select().from(subcategories).where(eq(subcategories.slug, slug));
    return result?.[0];
  }
  
  async createSubcategory(insertSubcategory: InsertSubcategory): Promise<Subcategory> {
    const now = new Date().toISOString();
    const result = await db.insert(subcategories).values({
      ...insertSubcategory,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result?.[0];
  }
  
  async updateSubcategory(id: number, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(subcategories)
      .set({
        ...data,
        updatedAt: now
      })
      .where(eq(subcategories.id, id))
      .returning();
    return result?.[0];
  }
  
  async deleteSubcategory(id: number): Promise<boolean> {
    // First check if there are videos using this subcategory
    const videosUsingSubcategory = await db.select({ count: sql`count(*)` })
      .from(videos)
      .where(eq(videos.subcategoryId, id));
    
    // Get count as number safely
    const videoCount = Number(videosUsingSubcategory?.[0]?.count ?? 0);
    if (videoCount > 0) {
      return false; // Cannot delete a subcategory with videos
    }
    
    const result = await db.delete(subcategories).where(eq(subcategories.id, id)).returning();
    // Check result length safely
    return Array.isArray(result) ? result.length > 0 : false;
  }
  
  // --------------------- Tag Management --------------------- //
  
  async getTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(asc(tags.name));
  }
  
  async getTag(id: number): Promise<Tag | undefined> {
    const result = await db.select().from(tags).where(eq(tags.id, id));
    return result[0];
  }
  
  async getTagBySlug(slug: string): Promise<Tag | undefined> {
    const result = await db.select().from(tags).where(eq(tags.slug, slug));
    return result[0];
  }
  
  async createTag(insertTag: InsertTag): Promise<Tag> {
    const result = await db.insert(tags).values(insertTag).returning();
    return result[0];
  }
  
  async updateTag(id: number, data: Partial<InsertTag>): Promise<Tag | undefined> {
    const result = await db.update(tags)
      .set(data)
      .where(eq(tags.id, id))
      .returning();
    return result[0];
  }
  
  async deleteTag(id: number): Promise<boolean> {
    // First delete any video-tag relationships
    await db.delete(videoTags).where(eq(videoTags.tagId, id));
    
    // Then delete the tag
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  }
  
  // --------------------- Video-Tag Management --------------------- //
  
  async getVideoTags(videoId: number): Promise<Tag[]> {
    return await db.select()
      .from(tags)
      .innerJoin(videoTags, eq(tags.id, videoTags.tagId))
      .where(eq(videoTags.videoId, videoId))
      .orderBy(asc(tags.name));
  }
  
  async addTagToVideo(videoId: number, tagId: number): Promise<void> {
    // Check if the relationship already exists
    const existing = await db.select()
      .from(videoTags)
      .where(and(
        eq(videoTags.videoId, videoId),
        eq(videoTags.tagId, tagId)
      ));
    
    if (existing.length === 0) {
      await db.insert(videoTags).values({
        videoId,
        tagId
      });
    }
  }
  
  async removeTagFromVideo(videoId: number, tagId: number): Promise<void> {
    await db.delete(videoTags)
      .where(and(
        eq(videoTags.videoId, videoId),
        eq(videoTags.tagId, tagId)
      ));
  }
  
  // --------------------- Activity Logs --------------------- //
  
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(insertLog).returning();
    return result[0];
  }
  
  async getActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
    return await db.select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }
  
  async getActivityLogsByUser(userId: number, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }
  
  async getActivityLogsByEntityType(entityType: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select()
      .from(activityLogs)
      .where(eq(activityLogs.entityType, entityType))
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }
  
  // --------------------- Statistics --------------------- //
  
  async getVideoCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(videos);
    return result[0].count;
  }
  
  async getCategoryCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(categories);
    return result[0].count;
  }
  
  async getTagCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(tags);
    return result[0].count;
  }
  
  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(users);
    return result[0].count;
  }

  // --------------------- Comments Management --------------------- //
  
  async getVideoComments(videoId: number): Promise<Comment[]> {
    return await db.select()
      .from(comments)
      .where(eq(comments.videoId, videoId))
      .orderBy(desc(comments.createdAt));
  }

  async getComment(id: number): Promise<Comment | undefined> {
    const result = await db.select().from(comments).where(eq(comments.id, id));
    return result[0];
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const now = new Date().toISOString();
    const result = await db.insert(comments).values({
      ...insertComment,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result[0];
  }

  async updateComment(id: number, content: string): Promise<Comment | undefined> {
    const now = new Date().toISOString();
    const result = await db.update(comments)
      .set({
        content,
        updatedAt: now
      })
      .where(eq(comments.id, id))
      .returning();
    return result[0];
  }

  async deleteComment(id: number): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    return result.length > 0;
  }

  async getLastUserComment(userId: number): Promise<Comment | undefined> {
    const result = await db.select()
      .from(comments)
      .where(eq(comments.userId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(1);
    return result[0];
  }

  // --------------------- Ratings Management --------------------- //
  
  async getVideoRating(videoId: number, userId: number): Promise<Rating | undefined> {
    const result = await db.select()
      .from(ratings)
      .where(and(
        eq(ratings.videoId, videoId),
        eq(ratings.userId, userId)
      ));
    return result[0];
  }

  async getVideoAverageRating(videoId: number): Promise<number> {
    const result = await db.select({
      average: sql`ROUND(AVG(${ratings.rating}), 2)`
    })
    .from(ratings)
    .where(eq(ratings.videoId, videoId));
    return result[0].average || 0;
  }

  async createOrUpdateRating(insertRating: InsertRating): Promise<Rating> {
    const now = new Date().toISOString();
    const existing = await this.getVideoRating(insertRating.videoId, insertRating.userId);

    if (existing) {
      const result = await db.update(ratings)
        .set({
          rating: insertRating.rating,
          updatedAt: now
        })
        .where(eq(ratings.id, existing.id))
        .returning();
      return result[0];
    }

    const result = await db.insert(ratings).values({
      ...insertRating,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result[0];
  }

  async deleteRating(id: number): Promise<boolean> {
    const result = await db.delete(ratings).where(eq(ratings.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();