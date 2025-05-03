import { pgTable, serial, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core"; import { createInsertSchema } from "drizzle-zod"; import { z } from "zod";

const defaultDate = () => new Date().toISOString();

export const users = pgTable("users", { id: serial("id").primaryKey(), username: text("username").notNull().unique(), password: text("password").notNull(), isAdmin: boolean("is_admin").notNull().default(false), createdAt: timestamp("created_at").defaultNow(), lastLogin: timestamp("last_login"), });

export const categories = pgTable("categories", { id: serial("id").primaryKey(), name: text("name").notNull(), description: text("description"), slug: text("slug").notNull().unique(), parentId: integer("parent_id").references(() => categories.id), createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(), });

export const subcategories = pgTable("subcategories", { id: serial("id").primaryKey(), name: text("name").notNull(), description: text("description"), slug: text("slug").notNull().unique(), categoryId: integer("category_id").notNull().references(() => categories.id), createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(), });

export const tags = pgTable("tags", { id: serial("id").primaryKey(), name: text("name").notNull().unique(), slug: text("slug").notNull().unique(), createdAt: timestamp("created_at").defaultNow(), });

export const videos = pgTable("videos", { id: serial("id").primaryKey(), title: text("title").notNull(), description: text("description"), youtubeId: text("youtube_id").notNull(), categoryId: integer("category_id").references(() => categories.id), subcategoryId: integer("subcategory_id").references(() => subcategories.id), thumbnail: text("thumbnail"), duration: text("duration"), createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(), views: integer("views").default(0), });

export const videoTags = pgTable("video_tags", { videoId: integer("video_id").notNull().references(() => videos.id), tagId: integer("tag_id").notNull().references(() => tags.id), }, (t) => ({ pk: primaryKey({ columns: [t.videoId, t.tagId] }), }));

export const activityLogs = pgTable("activity_logs", { id: serial("id").primaryKey(), userId: integer("user_id").references(() => users.id), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: integer("entity_id"), details: text("details"), timestamp: timestamp("timestamp").defaultNow(), ipAddress: text("ip_address"), });

export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true, isAdmin: true, });

export const insertCategorySchema = createInsertSchema(categories).pick({ name: true, description: true, slug: true, parentId: true, });

export const insertSubcategorySchema = createInsertSchema(subcategories).pick({ name: true, description: true, slug: true, categoryId: true, });

export const insertTagSchema = createInsertSchema(tags).pick({ name: true, slug: true, });

export const insertVideoSchema = createInsertSchema(videos).pick({ title: true, description: true, youtubeId: true, categoryId: true, subcategoryId: true, thumbnail: true, duration: true, });

export const insertVideoTagSchema = createInsertSchema(videoTags);

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({ userId: true, action: true, entityType: true, entityId: true, details: true, ipAddress: true, });

export type InsertUser = z.infer<typeof insertUserSchema>; export type User = typeof users.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>; export type Category = typeof categories.$inferSelect;

export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>; export type Subcategory = typeof subcategories.$inferSelect;

export type InsertTag = z.infer<typeof insertTagSchema>; export type Tag = typeof tags.$inferSelect;

export type InsertVideo = z.infer<typeof insertVideoSchema>; export type Video = typeof videos.$inferSelect;

export type InsertVideoTag = z.infer<typeof insertVideoTagSchema>; export type VideoTag = typeof videoTags.$inferSelect;

export const watchedChannels = pgTable("watched_channels", { id: serial("id").primaryKey(), channelId: text("channel_id").notNull().unique(), frequency: text("frequency").notNull(), lastCheck: timestamp("last_check"), createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(), });

export const insertWatchedChannelSchema = createInsertSchema(watchedChannels).pick({ channelId: true, frequency: true, });

export type InsertWatchedChannel = z.infer<typeof insertWatchedChannelSchema>; export type WatchedChannel = typeof watchedChannels.$inferSelect;

export const comments = pgTable("comments", { id: serial("id").primaryKey(), videoId: integer("video_id").notNull().references(() => videos.id), userId: integer("user_id").notNull().references(() => users.id), content: text("content").notNull(), createdAt: timestamp("created_at").defaultNow(), updatedAt: timestamp("updated_at").defaultNow(), });

export const ratings = pgTable("ratings", { id: serial("id").primaryKey(), videoId: integer

