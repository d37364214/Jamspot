import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const defaultDate = () => new Date().toISOString();

// Utilisateurs
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(defaultDate()),
  lastLogin: text("last_login"),
});

// Catégories principales
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id").references(() => categories.id),
  createdAt: text("created_at").default(defaultDate()),
  updatedAt: text("updated_at").default(defaultDate()),
});

// Sous-catégories (relation avec les catégories principales)
export const subcategories = sqliteTable("subcategories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  createdAt: text("created_at").default(defaultDate()),
  updatedAt: text("updated_at").default(defaultDate()),
});

// Tags
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").default(defaultDate()),
});

// Vidéos
export const videos = sqliteTable("videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  youtubeId: text("youtube_id").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  thumbnail: text("thumbnail"),
  duration: text("duration"),
  createdAt: text("created_at").default(defaultDate()),
  updatedAt: text("updated_at").default(defaultDate()),
  views: integer("views").default(0),
});

// Relation many-to-many entre vidéos et tags
export const videoTags = sqliteTable("video_tags", {
  videoId: integer("video_id").notNull().references(() => videos.id),
  tagId: integer("tag_id").notNull().references(() => tags.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.videoId, t.tagId] }),
}));

// Historique des actions administratives
export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // 'create', 'update', 'delete'
  entityType: text("entity_type").notNull(), // 'video', 'category', 'tag', 'user'
  entityId: integer("entity_id"),
  details: text("details"), // JSON string with details of the action
  timestamp: text("timestamp").default(defaultDate()),
  ipAddress: text("ip_address"),
});

// Schémas d'insertion
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
  slug: true,
  parentId: true,
});

export const insertSubcategorySchema = createInsertSchema(subcategories).pick({
  name: true,
  description: true,
  slug: true,
  categoryId: true,
});

export const insertTagSchema = createInsertSchema(tags).pick({
  name: true,
  slug: true,
});

export const insertVideoSchema = createInsertSchema(videos).pick({
  title: true,
  description: true,
  youtubeId: true,
  categoryId: true,
  subcategoryId: true,
  thumbnail: true,
  duration: true,
});

export const insertVideoTagSchema = createInsertSchema(videoTags);

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
  userId: true,
  action: true,
  entityType: true,
  entityId: true,
  details: true,
  ipAddress: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;

export type InsertVideoTag = z.infer<typeof insertVideoTagSchema>;
export type VideoTag = typeof videoTags.$inferSelect;

// Chaînes YouTube surveillées
export const watchedChannels = sqliteTable("watched_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channel_id").notNull().unique(),
  frequency: text("frequency").notNull(), // daily ou weekly
  lastCheck: text("last_check"),
  createdAt: text("created_at").default(defaultDate()),
  updatedAt: text("updated_at").default(defaultDate()),
});

export const insertWatchedChannelSchema = createInsertSchema(watchedChannels).pick({
  channelId: true,
  frequency: true,
});

export type InsertWatchedChannel = z.infer<typeof insertWatchedChannelSchema>;
export type WatchedChannel = typeof watchedChannels.$inferSelect;

// Commentaires
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id").notNull().references(() => videos.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: text("created_at").default(defaultDate()),
  updatedAt: text("updated_at").default(defaultDate())
});

// Notations
export const ratings = sqliteTable("ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id").notNull().references(() => videos.id),
  userId: integer("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  createdAt: text("created_at").default(defaultDate()),
  updatedAt: text("updated_at").default(defaultDate())
});

// Schémas d'insertion
export const insertCommentSchema = createInsertSchema(comments).pick({
  videoId: true,
  userId: true,
  content: true
});

export const insertRatingSchema = createInsertSchema(ratings).pick({
  videoId: true,
  userId: true,
  rating: true
}).extend({
  rating: z.number().min(1).max(5)
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
