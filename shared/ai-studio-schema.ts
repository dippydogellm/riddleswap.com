import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// AI Generated Images table
export const aiGeneratedImages = pgTable("ai_generated_images", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  prompt: text("prompt").notNull(),
  input_image_url: text("input_image_url"), // Optional input image for editing
  output_image_url: text("output_image_url").notNull(),
  model: text("model").notNull().default("gpt-image-1"), // gpt-image-1, dall-e-3, etc
  size: text("size").default("1024x1024"), // Image size
  quality: text("quality").default("standard"), // standard or hd
  style: text("style"), // vivid, natural
  
  // Generation details
  generation_type: text("generation_type").notNull(), // 'create' or 'edit'
  revised_prompt: text("revised_prompt"), // OpenAI may revise prompts
  
  // Storage and status
  status: text("status").notNull().default("completed"), // pending, completed, failed
  error_message: text("error_message"),
  
  // NFT conversion tracking
  is_nft: boolean("is_nft").default(false),
  nft_project_id: text("nft_project_id"),
  nft_token_id: text("nft_token_id"),
  
  // Video project association
  video_project_id: integer("video_project_id"),
  video_frame_order: integer("video_frame_order"), // Order in video if part of one
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_images_user").on(table.user_id),
  index("idx_ai_images_status").on(table.status),
  index("idx_ai_images_video_project").on(table.video_project_id),
  index("idx_ai_images_nft_project").on(table.nft_project_id),
]);

// AI Video Projects table
export const aiVideoProjects = pgTable("ai_video_projects", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  project_name: text("project_name").notNull(),
  description: text("description"),
  
  // Video creation prompt
  video_prompt: text("video_prompt").notNull(),
  
  // Images included in video
  image_count: integer("image_count").notNull().default(0),
  image_ids: jsonb("image_ids").$type<number[]>().default([]),
  
  // Pricing and payment
  total_images: integer("total_images").notNull(), // Total images in video
  price_xrp: decimal("price_xrp", { precision: 18, scale: 8 }).notNull(), // Price in XRP
  payment_status: text("payment_status").notNull().default("pending"), // pending, paid, failed
  payment_tx_hash: text("payment_tx_hash"), // XRP transaction hash
  
  // Video output
  video_url: text("video_url"), // Generated video URL
  video_duration: integer("video_duration"), // Duration in seconds
  video_format: text("video_format").default("mp4"),
  video_resolution: text("video_resolution").default("1920x1080"),
  
  // Status tracking
  status: text("status").notNull().default("draft"), // draft, processing, completed, failed
  processing_started_at: timestamp("processing_started_at"),
  completed_at: timestamp("completed_at"),
  error_message: text("error_message"),
  
  // NFT conversion
  is_nft: boolean("is_nft").default(false),
  nft_project_id: text("nft_project_id"),
  nft_token_id: text("nft_token_id"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_video_projects_user").on(table.user_id),
  index("idx_video_projects_status").on(table.status),
  index("idx_video_projects_payment").on(table.payment_status),
]);

// AI NFT Collections table (for images/videos converted to NFTs)
export const aiNftCollections = pgTable("ai_nft_collections", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  
  // Collection details
  collection_name: text("collection_name").notNull(),
  collection_description: text("collection_description"),
  collection_symbol: text("collection_symbol"),
  
  // Source tracking
  source_type: text("source_type").notNull(), // 'image' or 'video'
  source_id: integer("source_id").notNull(), // ID from aiGeneratedImages or aiVideoProjects
  
  // DevTools project ID
  devtools_project_id: text("devtools_project_id"), // Link to devtools project
  
  // Blockchain details
  chain: text("chain").notNull().default("xrpl"), // xrpl, eth, sol
  contract_address: text("contract_address"),
  token_id: text("token_id"),
  
  // Metadata
  metadata_url: text("metadata_url"),
  metadata_json: jsonb("metadata_json").$type<Record<string, any>>(),
  
  // Minting status
  mint_status: text("mint_status").notNull().default("draft"), // draft, pending, minted, failed
  mint_tx_hash: text("mint_tx_hash"),
  minted_at: timestamp("minted_at"),
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_nft_user").on(table.user_id),
  index("idx_ai_nft_source").on(table.source_type, table.source_id),
  index("idx_ai_nft_devtools").on(table.devtools_project_id),
  index("idx_ai_nft_status").on(table.mint_status),
]);

// Relations
export const aiGeneratedImagesRelations = relations(aiGeneratedImages, ({ one }) => ({
  videoProject: one(aiVideoProjects, {
    fields: [aiGeneratedImages.video_project_id],
    references: [aiVideoProjects.id],
  }),
}));

export const aiVideoProjectsRelations = relations(aiVideoProjects, ({ many }) => ({
  images: many(aiGeneratedImages),
}));

// Zod schemas for validation
export const insertAiImageSchema = createInsertSchema(aiGeneratedImages);
export const insertAiVideoProjectSchema = createInsertSchema(aiVideoProjects);
export const insertAiNftCollectionSchema = createInsertSchema(aiNftCollections);

export type AiGeneratedImage = typeof aiGeneratedImages.$inferSelect;
export type InsertAiGeneratedImage = z.infer<typeof insertAiImageSchema>;

export type AiVideoProject = typeof aiVideoProjects.$inferSelect;
export type InsertAiVideoProject = z.infer<typeof insertAiVideoProjectSchema>;

export type AiNftCollection = typeof aiNftCollections.$inferSelect;
export type InsertAiNftCollection = z.infer<typeof insertAiNftCollectionSchema>;
