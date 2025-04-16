import { User, InsertUser, Category, InsertCategory, Video, InsertVideo } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getVideos(): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: User[] = [];
  private videos: Video[] = [];
  private categories: Category[] = [];
  private userIdCounter = 1;
  private videoIdCounter = 1;
  private categoryIdCounter = 1;
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const newUser: User = {
      ...insertUser,
      id: this.userIdCounter++,
      isAdmin: false,
    };
    this.users.push(newUser);
    return newUser;
  }

  async getVideos(): Promise<Video[]> {
    return this.videos;
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const now = new Date();
    const newVideo: Video = {
      ...insertVideo,
      id: this.videoIdCounter++,
      createdAt: now,
    };
    this.videos.push(newVideo);
    return newVideo;
  }

  async getCategories(): Promise<Category[]> {
    return this.categories;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const newCategory: Category = {
      ...insertCategory,
      id: this.categoryIdCounter++,
    };
    this.categories.push(newCategory);
    return newCategory;
  }
}

export const storage = new MemStorage();