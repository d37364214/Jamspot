import type { NextApiRequest, NextApiResponse } from 'next'; // Vercel
 import { google } from 'googleapis';
 import { storage } from '@shared/storage';
 import dotenv from 'dotenv';
 
 dotenv.config();
 
 const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });
 
 export default async function handler(req: NextApiRequest, res: NextApiResponse) { // Vercel
  if (req.method !== 'POST') {
  return res.status(405).json({ error: "Méthode non autorisée" });
  }
 
  //  if (!req.user?.isAdmin) { // À adapter à ton système d'authentification serverless
  //  return res.status(403).json({ error: "Accès non autorisé" });
  //  }
 
  try {
  const { playlistUrl } = req.body;
  if (!playlistUrl) {
  return res.status(400).json({ error: "URL de playlist manquante" });
  }
 
  const playlistId = playlistUrl.split("list=")[1]?.split("&")[0];
  if (!playlistId) {
  return res.status(400).json({ error: "URL de playlist invalide" });
  }
 
  const playlistItems = await youtube.playlistItems.list({
  part: ['snippet'],
  playlistId: playlistId,
  maxResults: 50
  });
 
  const videos = playlistItems.data.items?.map(item => {
  return {
  youtubeId: item.snippet?.resourceId?.videoId,
  title: item.snippet?.title,
  description: item.snippet?.description,
  // ... autres données
  };
  }) || [];
 
  for (const videoData of videos) {
  await storage.createVideo({
  ...videoData,
  categoryId: null, // À adapter
  subcategoryId: null, // À adapter
  });
  }
 
  await storage.createActivityLog({
  action: "IMPORT",
  entityType: "playlist",
  userId: "user_id", // À adapter
  details: `Import playlist: ${playlistUrl}`,
  timestamp: new Date().toISOString(),
  });
 
  return res.status(200).json({ // Vercel - Utilise res.status(200)
  message: "Import de playlist terminé",
  playlistId,
  importedCount: videos.length
  });
  } catch (error: any) {
  console.error("Erreur lors de l'import de la playlist:", error);
  return res.status(500).json({ error: "Erreur lors de l'import de la playlist", message: error.message }); // Vercel - Utilise res.status(500)
  }
 }
