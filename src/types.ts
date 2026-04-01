export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  partnerAppUrl?: string;
  autoSync?: boolean;
  createdAt: any;
  role?: 'user' | 'admin';
}

export interface Novel {
  id: string;
  authorUid: string;
  authorName?: string;
  authorPhoto?: string;
  title: string;
  genre: string;
  summary: string;
  coverImage?: string;
  status: 'draft' | 'published';
  likesCount: number;
  viewsCount: number;
  sharesCount: number;
  language?: 'ar' | 'en';
  violenceLevel?: 'none' | 'low' | 'medium' | 'high';
  moralTone?: 'moral' | 'neutral' | 'dark';
  fontFamily?: string;
  fontSize?: string;
  textAlign?: 'right' | 'left' | 'center' | 'justify';
  lineHeight?: string;
  previousPartId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  content: string;
  description?: string;
  order: number;
  createdAt: any;
  updatedAt: any;
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
  traits: string;
  description: string;
  createdAt: any;
}

export interface Follow {
  id: string;
  followerUid: string;
  followedUid: string;
  createdAt: any;
}

export interface Comment {
  id: string;
  novelId: string;
  chapterId: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt: any;
}

export interface LibraryItem {
  id: string;
  uid: string;
  novelId: string;
  addedAt: any;
}

export interface ReadingProgress {
  id: string;
  uid: string;
  novelId: string;
  lastChapterId: string;
  lastChapterOrder: number;
  updatedAt: any;
}

export interface WorldNote {
  id: string;
  novelId: string;
  title: string;
  category: 'location' | 'lore' | 'magic' | 'item' | 'other';
  content: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: any;
}
