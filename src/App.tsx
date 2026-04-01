import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc,
  increment,
  runTransaction,
  limit
} from 'firebase/firestore';
import { auth, db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDocFromServer, doc as firestoreDoc } from 'firebase/firestore';
import { Novel, Chapter, Character, UserProfile, Follow, Comment, LibraryItem, ReadingProgress } from './types';

// --- Error Handling & Boundary ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  UPLOAD = 'upload'
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore/Storage Error: ', JSON.stringify(errInfo));
  const finalError = new Error(JSON.stringify(errInfo));
  (finalError as any).isFirestoreError = true;
  throw finalError;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorDetails: FirestoreErrorInfo | null = null;
      try {
        if (this.state.error?.message) {
          errorDetails = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
          <div className="mb-6 text-red-600">
            <Settings size={64} className="mx-auto mb-4 opacity-20" />
            <h2 className="text-2xl font-bold mb-2">عذراً، حدث خطأ غير متوقع</h2>
            <p className="text-black/60 max-w-md mx-auto">
              {errorDetails ? `خطأ في عملية ${errorDetails.operationType}: ${errorDetails.error}` : this.state.error?.message || 'حدث خطأ غير معروف'}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="monochrome-button px-8"
          >
            إعادة تحميل التطبيق
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
import { 
  Book, 
  Plus, 
  PlusCircle,
  User as UserIcon, 
  Settings, 
  LogOut, 
  ChevronRight, 
  PenTool, 
  Users, 
  Sparkles, 
  Heart,
  Share2,
  Eye,
  Trash2, 
  ArrowLeft,
  Save,
  FileText,
  UserPlus,
  UserCheck,
  Search,
  Lock,
  Camera,
  Copy,
  Check,
  Bookmark,
  MessageSquare,
  TrendingUp,
  Clock,
  BarChart2,
  Download,
  Menu,
  X,
  Globe,
  RefreshCw,
  BookOpen,
  Image as ImageIcon,
  MoreVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Baseline,
  Maximize2,
  Minimize2,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import ReactQuill from 'react-quill-new';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { generatePlot, generateChapterContent, generateCover, generateAvatar, generateShortSummary, generateChapterDescription, suggestChapterTitle, generateEducationalBook, generateBookDescription, generateBookOutline, generateChapterContentForBook } from './services/gemini';
import { uploadBase64Image } from './services/storage';
import { resizeAndCompressImage } from './utils/image';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Components ---

const Logo = ({ size = 64, className = "" }: { size?: number, className?: string }) => (
  <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative h-full w-full"
    >
      <img 
        src="/logo.svg" 
        alt="Roayti Logo" 
        className="h-full w-full object-contain"
        onError={(e) => {
          // Fallback to SVG if image is not found
          e.currentTarget.style.display = 'none';
          const svg = e.currentTarget.nextElementSibling as HTMLElement;
          if (svg) svg.style.display = 'block';
        }}
      />
      <div style={{ display: 'none' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          <path d="M12 6v10" className="opacity-30" />
          <path d="M8 10h8" className="opacity-30" />
        </svg>
      </div>
      <div className="absolute -right-1 -top-1 text-black">
        <Sparkles size={size * 0.35} fill="currentColor" />
      </div>
    </motion.div>
  </div>
);

const Loading = () => (
  <div className="flex h-screen items-center justify-center bg-white">
    <div className="h-8 w-8 animate-spin border-4 border-black border-t-transparent"></div>
  </div>
);

const Auth = () => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setError('تم حظر النافذة المنبثقة. يرجى السماح بالمنبثقات لهذا الموقع والمحاولة مرة أخرى.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore
      } else {
        setError(`فشل تسجيل الدخول: ${error.message}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md"
      >
        <div className="mb-8 flex justify-center">
          <Logo size={80} />
        </div>
        <h1 className="mb-4 text-6xl font-serif font-bold tracking-tighter leading-tight">أبدأ رحلتك الابداعيه<br />RoaytiAI</h1>
        <p className="mb-8 text-black/60 font-medium">تطبيق الروايات مع لمسة من الذكاء الاصطناعي</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <button 
          onClick={handleLogin} 
          disabled={isLoggingIn}
          className="monochrome-button w-full py-4 text-lg flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isLoggingIn ? (
            <div className="h-6 w-6 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            <>
              <Sparkles size={24} />
              <span>ابدأ رحلتك الإبداعية</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string 
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-white p-8">
        <h3 className="mb-2 text-xl font-bold">{title}</h3>
        <p className="mb-8 text-sm text-black/60">{message}</p>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className="monochrome-button flex-grow bg-red-600 hover:bg-red-700"
          >
            {t('delete')}
          </button>
          <button onClick={onClose} className="monochrome-button-outline flex-grow">{t('cancel')}</button>
        </div>
      </motion.div>
    </div>
  );
};

const PublishModal = ({ 
  isOpen, 
  onClose, 
  onPublish, 
  novelId,
  initialName,
  initialCover,
  showToast
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onPublish: (name: string, cover: string) => void,
  novelId: string,
  initialName?: string,
  initialCover?: string,
  showToast: (msg: string, type?: 'success' | 'error') => void
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName || '');
  const [cover, setCover] = useState(initialCover || '');
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      const fileAsBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Compress first
      const compressed = await resizeAndCompressImage(fileAsBase64, 800, 1000, 0.7);
      
      try {
        const url = await uploadBase64Image(compressed, `covers/${novelId}.png`);
        setCover(url);
      } catch (storageErr) {
        console.warn("Storage upload failed, falling back to base64", storageErr);
        setCover(compressed);
      }
    } catch (e: any) {
      console.error("Error processing cover", e);
      showToast(`${t('error_uploading_cover')} ${e.message || t('unknown_error')}`, 'error');
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white p-8">
        <h3 className="mb-6 text-2xl font-bold">{t('publish_settings')}</h3>
        <div className="space-y-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('author_name')}</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="monochrome-input" 
              placeholder={t('literary_name')} 
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('novel_cover')}</label>
            <div className="flex items-center gap-4">
              <div className="h-32 w-24 shrink-0 border border-black/10 bg-black/5 flex items-center justify-center overflow-hidden">
                {cover ? (
                  <img src={cover} alt="Cover" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Logo size={32} className="opacity-10" />
                )}
              </div>
              <div className="flex-grow">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="hidden" 
                  id="cover-upload"
                />
                <label htmlFor="cover-upload" className="monochrome-button-outline cursor-pointer py-2 text-xs">
                  {uploading ? t('uploading') : t('upload_image')}
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => onPublish(name, cover)} 
              disabled={!name || uploading}
              className="monochrome-button flex-grow"
            >
              {t('confirm_publish')}
            </button>
            <button onClick={onClose} className="monochrome-button-outline flex-grow">{t('cancel')}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ProfileView = ({ 
  uid, 
  currentUser, 
  onBack, 
  onOpenNovel, 
  onFollow, 
  onUnfollow, 
  isFollowing,
  showToast
}: { 
  uid: string, 
  currentUser: User | null, 
  onBack: () => void, 
  onOpenNovel: (novel: Novel) => void,
  onFollow: (uid: string) => void,
  onUnfollow: (uid: string) => void,
  isFollowing: boolean,
  showToast: (msg: string, type?: 'success' | 'error') => void
}) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userNovels, setUserNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const fetchProfile = () => {
      setLoading(true);
      const unsubscribe = onSnapshot(doc(db, 'users_public', uid), async (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        
        try {
          const q = query(
            collection(db, 'novels'), 
            where('authorUid', '==', uid), 
            where('status', '==', 'published'),
            orderBy('updatedAt', 'desc')
          );
          const novelSnap = await getDocs(q);
          setUserNovels(novelSnap.docs.map(d => ({ id: d.id, ...d.data() } as Novel)));

          // Fetch counts
          const followersQ = query(collection(db, 'follows'), where('followedUid', '==', uid));
          const followingQ = query(collection(db, 'follows'), where('followerUid', '==', uid));
          const [folsSnap, fingSnap] = await Promise.all([getDocs(followersQ), getDocs(followingQ)]);
          setFollowersCount(folsSnap.size);
          setFollowingCount(fingSnap.size);
        } catch (e) {
          console.error("Error fetching profile data", e);
        }
        setLoading(false);
      }, (error) => {
        console.error("Error in profile snapshot", error);
        setLoading(false);
      });
      return unsubscribe;
    };
    const unsubscribe = fetchProfile();
    return () => unsubscribe();
  }, [uid]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('profile_share_title', { name: profile?.displayName }),
          text: t('profile_share_text', { name: profile?.displayName }),
          url: window.location.href,
        });
      } catch (e) {
        console.error("Error sharing", e);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      showToast(t('link_copied', 'تم نسخ الرابط!'));
    }
  };

  if (loading) return <div className="flex py-20 justify-center"><div className="h-8 w-8 animate-spin border-4 border-black border-t-transparent"></div></div>;
  if (!profile) return <div className="py-20 text-center">{t('user_not_found', 'المستخدم غير موجود')}</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl px-6 py-12"
    >
      <button onClick={onBack} className="mb-8 flex items-center gap-2 text-black/50 hover:text-black">
        <ArrowLeft size={20} /> <span>{t('back')}</span>
      </button>

      <div className="mb-12 flex flex-col items-center text-center md:flex-row md:text-right gap-8">
        <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-black/5 bg-black/5">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt={profile.displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/5 text-black/20">
              <UserIcon size={64} />
            </div>
          )}
        </div>
        <div className="flex-grow">
          <div className="mb-2 flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <h2 className="text-4xl font-serif font-bold">{profile.displayName}</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleShare}
                className="monochrome-button-outline p-2 rounded-full"
                title={t('share_profile', 'مشاركة الحساب')}
              >
                <Share2 size={20} />
              </button>
              {currentUser && currentUser.uid !== uid && (
                <button 
                  onClick={() => isFollowing ? onUnfollow(uid) : onFollow(uid)}
                  className={isFollowing ? "monochrome-button-outline px-8" : "monochrome-button px-8"}
                >
                  {isFollowing ? <><UserCheck size={18} /> <span>{t('following')}</span></> : <><UserPlus size={18} /> <span>{t('follow')}</span></>}
                </button>
              )}
            </div>
          </div>
          <div className="mb-4 flex justify-center md:justify-start gap-8">
            <div className="flex flex-col items-center md:items-start">
              <span className="text-xl font-bold">{followersCount}</span>
              <span className="text-xs text-black/40">{t('followers', 'متابع')}</span>
            </div>
            <div className="flex flex-col items-center md:items-start">
              <span className="text-xl font-bold">{followingCount}</span>
              <span className="text-xs text-black/40">{t('following_count', 'أتابع')}</span>
            </div>
          </div>
          <p className="max-w-2xl text-black/60">{profile.bio || t('no_bio', 'لا يوجد وصف شخصي بعد...')}</p>
        </div>
      </div>

      <div className="border-t border-black/10 pt-12">
        <h3 className="mb-8 text-2xl font-serif font-bold">{t('published_novels', 'الروايات المنشورة')}</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {userNovels.map(novel => (
            <div key={novel.id} className="monochrome-card group flex gap-4 p-4">
              <div className="h-32 w-24 shrink-0 bg-black/5 flex items-center justify-center overflow-hidden border border-black/5">
                {novel.coverImage ? (
                  <img src={novel.coverImage} alt={novel.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center opacity-10">
                    <Logo size={32} />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-between py-1">
                <div>
                  <h4 className="font-bold line-clamp-1">{novel.title}</h4>
                  <p className="text-xs text-black/50 line-clamp-2 mt-1">{novel.summary}</p>
                </div>
                <button 
                  onClick={() => onOpenNovel(novel)}
                  className="text-xs font-bold underline underline-offset-4"
                >
                  {t('read_now', 'قراءة الآن')}
                </button>
              </div>
            </div>
          ))}
          {userNovels.length === 0 && (
            <div className="col-span-full py-12 text-center text-black/30">
              {t('no_published_novels_author', 'لا توجد روايات منشورة لهذا الكاتب.')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const FollowingView = ({ 
  profiles, 
  onOpenProfile, 
  onBack,
  currentUser
}: { 
  profiles: UserProfile[], 
  onOpenProfile: (uid: string) => void,
  onBack: () => void,
  currentUser: User | null
}) => {
  const { t } = useTranslation();
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-4xl px-6 py-12"
    >
      <button onClick={onBack} className="mb-8 flex items-center gap-2 text-black/50 hover:text-black">
        <ArrowLeft size={20} /> <span>{t('back_to_library', 'العودة للمكتبة')}</span>
      </button>

      <div className="mb-12">
        <h2 className="text-4xl font-serif font-bold">{t('following')}</h2>
        <p className="text-black/50">{t('following_slogan', 'اكتشف جديد الكتاب المفضلين لديك.')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map(profile => (
          <button 
            key={profile.uid}
            onClick={() => onOpenProfile(profile.uid)}
            disabled={profile.uid === currentUser?.uid}
            className={`monochrome-card flex items-center gap-4 transition-all ${profile.uid === currentUser?.uid ? 'opacity-50 cursor-not-allowed' : 'hover:border-black'}`}
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-black/5">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-black/20">
                  <UserIcon size={24} />
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-bold">{profile.displayName}</div>
              <div className="text-[10px] text-black/40">
                {profile.uid === currentUser?.uid ? t('this_is_you', 'هذا أنت') : t('view_profile', 'عرض الملف الشخصي')}
              </div>
            </div>
          </button>
        ))}
        {profiles.length === 0 && (
          <div className="col-span-full py-20 text-center text-black/30">
            {t('no_following_message', 'أنت لا تتابع أحداً بعد. استكشف الروايات لتجد كتابك المفضلين!')}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const CommentsSection = ({ novelId, chapterId, currentUser, isAdmin, onDeleteComment }: { 
  novelId: string, 
  chapterId: string, 
  currentUser: User | null,
  isAdmin: boolean,
  onDeleteComment: (commentId: string) => void
}) => {
  const { t, i18n } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `novels/${novelId}/chapters/${chapterId}/comments`), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    });
    return () => unsubscribe();
  }, [novelId, chapterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, `novels/${novelId}/chapters/${chapterId}/comments`), {
        novelId,
        chapterId,
        authorUid: currentUser.uid,
        authorName: currentUser.displayName || t('anonymous_user'),
        authorPhoto: currentUser.photoURL,
        text: newComment.trim(),
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'comments');
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-12 border-t border-black/10 pt-12">
      <h3 className="mb-8 flex items-center gap-2 text-xl font-bold">
        <MessageSquare size={20} /> {t('comments')} ({comments.length})
      </h3>

      {currentUser ? (
        <form onSubmit={handleSubmit} className="mb-12">
          <textarea 
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={t('leave_comment_placeholder')}
            className="monochrome-input mb-4 min-h-[100px] resize-none"
          />
          <button 
            type="submit" 
            disabled={submitting || !newComment.trim()}
            className="monochrome-button"
          >
            {submitting ? t('posting') : t('post_comment')}
          </button>
        </form>
      ) : (
        <div className="mb-12 rounded-xl bg-black/5 p-8 text-center">
          <p className="text-black/50">{t('login_to_comment')}</p>
        </div>
      )}

      <div className="space-y-8">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-4">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-black/5">
              {comment.authorPhoto ? (
                <img src={comment.authorPhoto} alt={comment.authorName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-black/20">
                  <UserIcon size={20} />
                </div>
              )}
            </div>
            <div className="flex-grow text-right">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{comment.authorName}</span>
                  {(isAdmin || (currentUser && currentUser.uid === comment.authorUid)) && (
                    <button 
                      onClick={() => onDeleteComment(comment.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                      title={t('delete_comment')}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <span className="text-[10px] opacity-30">
                  {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US') : t('now')}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-black/70">{comment.text}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="py-8 text-center text-black/20">لا توجد تعليقات بعد. كن أول من يعلق!</p>
        )}
      </div>
    </div>
  );
};

const LibraryView = ({ library, novels, readingProgress, onOpenNovel }: { 
  library: LibraryItem[], 
  novels: Novel[], 
  readingProgress: ReadingProgress[],
  onOpenNovel: (n: Novel) => void 
}) => {
  const { t } = useTranslation();
  const libraryNovels = Array.from(new Map(novels.map(n => [n.id, n])).values())
    .filter(n => library.some(l => l.novelId === n.id));

  const getProgress = (novelId: string) => {
    return readingProgress.find(p => p.novelId === novelId);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-serif font-bold tracking-tighter">{t('library')}</h2>
        <span className="text-xs font-bold uppercase tracking-widest opacity-40">{libraryNovels.length} {t('novel_count', 'رواية')}</span>
      </div>

      {libraryNovels.length > 0 ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {libraryNovels.map(novel => (
            <button 
              key={novel.id} 
              onClick={() => onOpenNovel(novel)}
              className="group flex flex-col gap-3 text-right"
            >
              <div className="aspect-[3/4] w-full overflow-hidden border border-black/10 bg-black/5 shadow-sm transition-all group-hover:scale-[1.02] group-hover:shadow-xl relative">
                {novel.coverImage ? (
                  <img src={novel.coverImage} alt={novel.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center opacity-10">
                    <Logo size={48} />
                  </div>
                )}
                {getProgress(novel.id) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-center text-[10px] font-bold text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('continue_reading', 'متابعة القراءة')}
                  </div>
                )}
              </div>
              <div>
                <h3 className="line-clamp-1 font-serif text-lg font-bold leading-tight">{novel.title}</h3>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{novel.genre}</p>
                  {getProgress(novel.id) && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <BarChart2 size={10} /> {t('chapter')} {getProgress(novel.id)?.lastChapterOrder}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark size={48} className="mb-4 opacity-10" />
          <p className="text-black/30">{t('empty_library_message', 'مكتبتك فارغة حالياً. ابدأ باستكشاف الروايات وإضافتها هنا.')}</p>
        </div>
      )}
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'explore' | 'novel' | 'editor' | 'characters' | 'settings' | 'reader' | 'profile' | 'following' | 'search' | 'library' | 'ai-books'>('explore');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [publicNovels, setPublicNovels] = useState<Novel[]>([]);
  const [publicUsers, setPublicUsers] = useState<UserProfile[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<UserProfile[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [showNewNovelModal, setShowNewNovelModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ novels: Novel[], users: UserProfile[] }>({ novels: [], users: [] });
  const isAdmin = user?.email === 'ahmad.meshaal.2040@gmail.com' || userProfile?.role === 'admin';
  const [searching, setSearching] = useState(false);
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [newNovelLanguage, setNewNovelLanguage] = useState<'ar' | 'en'>('ar');
  const [newNovelViolence, setNewNovelViolence] = useState<'none' | 'low' | 'medium' | 'high'>('none');
  const [newNovelMoral, setNewNovelMoral] = useState<'moral' | 'neutral' | 'dark'>('neutral');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(firestoreDoc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync user profile
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const newProfile = {
            uid: u.uid,
            displayName: u.displayName || 'كاتب مجهول',
            email: u.email || '',
            photoURL: u.photoURL || '',
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newProfile);
          
          // Create public profile
          const publicProfile = {
            uid: u.uid,
            displayName: newProfile.displayName,
            photoURL: newProfile.photoURL,
            createdAt: newProfile.createdAt
          };
          await setDoc(doc(db, 'users_public', u.uid), publicProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'follows'), where('followerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const followDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Follow));
      setFollows(followDocs);
      
      // Fetch profiles of followed users
      if (followDocs.length > 0) {
        const profilePromises = followDocs.map(f => getDoc(doc(db, 'users_public', f.followedUid)));
        const profileSnaps = await Promise.all(profilePromises);
        const profiles = profileSnaps.map(s => s.data() as UserProfile).filter(p => !!p);
        setFollowingProfiles(profiles);
      } else {
        setFollowingProfiles([]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'follows');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'library'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLibrary(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'library');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'readingProgress'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReadingProgress(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReadingProgress)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'readingProgress');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedNovel) return;
    const unsubscribe = onSnapshot(doc(db, 'novels', selectedNovel.id), (snap) => {
      if (snap.exists()) {
        setSelectedNovel({ id: snap.id, ...snap.data() } as Novel);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `novels/${selectedNovel.id}`);
    });
    return () => unsubscribe();
  }, [selectedNovel?.id]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'novels'), where('authorUid', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Novel));
      setNovels(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'novels');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'novels'), where('status', '==', 'published'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Novel));
      setPublicNovels(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'public_novels');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users_public'), limit(1000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => d.data() as UserProfile);
      setPublicUsers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'public_users');
    });
    return () => unsubscribe();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setView('search');
    try {
      const queryLower = searchQuery.toLowerCase();
      
      // Search Novels (client-side filter)
      const filteredNovels = publicNovels.filter(n => 
        n.title.toLowerCase().includes(queryLower) || 
        (n.summary && n.summary.toLowerCase().includes(queryLower)) ||
        (n.authorName && n.authorName.toLowerCase().includes(queryLower))
      );

      // Search Users (client-side filter for case-insensitivity)
      const filteredUsers = publicUsers.filter(u => 
        u.displayName.toLowerCase().includes(queryLower) ||
        (u.bio && u.bio.toLowerCase().includes(queryLower))
      );

      setSearchResults({ novels: filteredNovels, users: filteredUsers });
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  if (loading) return <Loading />;
  
  // Allow public views without auth
  const publicViews = ['explore', 'reader', 'profile', 'search'];
  if (!user && !publicViews.includes(view)) {
    return <Auth />;
  }

  const createNovel = async () => {
    if (!newNovelTitle.trim()) return;
    const path = 'novels';
    try {
      await addDoc(collection(db, path), {
        authorUid: user.uid,
        title: newNovelTitle.trim(),
        genre: 'دراما',
        summary: '',
        status: 'draft',
        likesCount: 0,
        viewsCount: 0,
        sharesCount: 0,
        language: newNovelLanguage,
        violenceLevel: newNovelViolence,
        moralTone: newNovelMoral,
        fontFamily: 'var(--font-serif)',
        fontSize: '1.125rem',
        textAlign: 'right',
        lineHeight: '1.75',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewNovelTitle('');
      setNewNovelLanguage('ar');
      setNewNovelViolence('none');
      setNewNovelMoral('neutral');
      setShowNewNovelModal(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const deleteNovel = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف الرواية',
      message: 'هل أنت متأكد من حذف هذه الرواية؟ سيتم حذف جميع الفصول والشخصيات المرتبطة بها نهائياً.',
      onConfirm: async () => {
        const path = `novels/${id}`;
        try {
          await deleteDoc(doc(db, 'novels', id));
          if (selectedNovel?.id === id) {
            setView('dashboard');
            setSelectedNovel(null);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, path);
        }
      }
    });
  };

  const deleteComment = async (novelId: string, chapterId: string, commentId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف التعليق',
      message: 'هل أنت متأكد من حذف هذا التعليق؟',
      onConfirm: async () => {
        const path = `novels/${novelId}/chapters/${chapterId}/comments/${commentId}`;
        try {
          await deleteDoc(doc(db, `novels/${novelId}/chapters/${chapterId}/comments`, commentId));
          showToast('تم حذف التعليق بنجاح.');
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, path);
          showToast('فشل حذف التعليق.', 'error');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const incrementStat = async (novelId: string, stat: 'likesCount' | 'viewsCount' | 'sharesCount') => {
    if (!user) return;
    const path = `novels/${novelId}`;
    
    try {
      const novelRef = doc(db, 'novels', novelId);
      
      if (stat === 'likesCount') {
        const likeRef = doc(db, `novels/${novelId}/likes`, user.uid);
        
        await runTransaction(db, async (transaction) => {
          const likeDoc = await transaction.get(likeRef);
          const novelDoc = await transaction.get(novelRef);
          
          if (!novelDoc.exists()) return;
          
          if (likeDoc.exists()) {
            // Unlike
            transaction.delete(likeRef);
            transaction.update(novelRef, {
              likesCount: increment(-1)
            });
          } else {
            // Like
            transaction.set(likeRef, {
              uid: user.uid,
              createdAt: serverTimestamp()
            });
            transaction.update(novelRef, {
              likesCount: increment(1)
            });
          }
        });
      } else {
        await updateDoc(novelRef, {
          [stat]: increment(1)
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const followAuthor = async (authorUid: string) => {
    if (!user || user.uid === authorUid) return;
    const path = 'follows';
    try {
      await addDoc(collection(db, path), {
        followerUid: user.uid,
        followedUid: authorUid,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const unfollowAuthor = async (authorUid: string) => {
    if (!user) return;
    const follow = follows.find(f => f.followedUid === authorUid);
    if (!follow) return;
    const path = `follows/${follow.id}`;
    try {
      await deleteDoc(doc(db, 'follows', follow.id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  const addToLibrary = async (novelId: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'library'), {
        uid: user.uid,
        novelId,
        addedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'library');
    }
  };

  const removeFromLibrary = async (novelId: string) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'library'), where('uid', '==', user.uid), where('novelId', '==', novelId));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'library', d.id)));
      await Promise.all(deletePromises);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'library');
    }
  };

  const handleSaveAIBook = async (title: string, content: string, category: string, description: string, cover: string) => {
    if (!user) return;
    const path = 'novels';
    try {
      const novelDoc = await addDoc(collection(db, path), {
        authorUid: user.uid,
        title: title,
        genre: category,
        summary: description || `كتاب تم تأليفه بالذكاء الاصطناعي حول موضوع: ${title}`,
        coverImage: cover || '',
        status: 'draft',
        likesCount: 0,
        viewsCount: 0,
        sharesCount: 0,
        language: i18n.language as any,
        violenceLevel: 'none',
        moralTone: 'moral',
        fontFamily: 'var(--font-serif)',
        fontSize: '1.125rem',
        textAlign: 'right',
        lineHeight: '1.75',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add the content as the first chapter
      await addDoc(collection(db, `novels/${novelDoc.id}/chapters`), {
        novelId: novelDoc.id,
        authorUid: user.uid,
        title: title,
        content: content,
        order: 1,
        status: 'draft',
        isPublished: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add to user's library
      await addToLibrary(novelDoc.id);

      setView('dashboard');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const updateReadingProgress = async (novelId: string, chapterId: string, chapterOrder: number) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'readingProgress'), where('uid', '==', user.uid), where('novelId', '==', novelId));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(collection(db, 'readingProgress'), {
          uid: user.uid,
          novelId,
          lastChapterId: chapterId,
          lastChapterOrder: chapterOrder,
          updatedAt: serverTimestamp()
        });
      } else {
        const progressDoc = snap.docs[0];
        if (progressDoc.data().lastChapterOrder < chapterOrder) {
          await updateDoc(doc(db, 'readingProgress', progressDoc.id), {
            lastChapterId: chapterId,
            lastChapterOrder: chapterOrder,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'readingProgress');
    }
  };

  return (
    <div className="min-h-screen bg-white text-black pb-20 md:pb-0">
      {/* Navigation - Top (Desktop) */}
      <nav className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setView('explore');
                setSelectedNovel(null);
              }}
              className="flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Logo size={32} />
              <span className="font-serif text-2xl font-bold tracking-tighter">{t('app_name')}</span>
            </button>
            <form onSubmit={handleSearch} className="relative flex-grow max-w-[150px] md:max-w-xs">
              <input 
                type="text" 
                placeholder={t('search')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-black/10 bg-black/5 py-1.5 pl-4 pr-10 text-xs md:text-sm focus:border-black focus:outline-none"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30" />
            </form>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <button onClick={() => setView('explore')} className={`transition-all ${view === 'explore' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}>{t('explore')}</button>
            {user ? (
              <>
                <button onClick={() => setView('dashboard')} className={`transition-all ${view === 'dashboard' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}>{t('write')}</button>
                <button onClick={() => setView('library')} className={`transition-all ${view === 'library' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}>{t('library')}</button>
                <button 
                  onClick={() => {
                    setSelectedProfileUid(user.uid);
                    setView('profile');
                  }} 
                  className={`flex items-center gap-2 transition-all ${view === 'profile' && selectedProfileUid === user.uid ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}
                >
                  <UserIcon size={20} />
                </button>
                <button onClick={() => setView('settings')} className={`transition-all ${view === 'settings' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}><Settings size={20} /></button>
                <div className="h-4 w-px bg-black/10"></div>
                <button 
                  onClick={() => changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
                  className="flex items-center gap-1 text-xs font-bold opacity-50 hover:opacity-100"
                >
                  <Globe size={16} />
                  {i18n.language === 'ar' ? 'EN' : 'AR'}
                </button>
                <button onClick={() => signOut(auth)} className="opacity-50 hover:opacity-100 hover:text-red-600"><LogOut size={20} /></button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
                  className="flex items-center gap-1 text-xs font-bold opacity-50 hover:opacity-100"
                >
                  <Globe size={16} />
                  {i18n.language === 'ar' ? 'EN' : 'AR'}
                </button>
                <button onClick={() => setView('dashboard')} className="monochrome-button px-6 py-1.5 text-xs">{t('login')}</button>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 md:hidden">
            <button 
              onClick={() => changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 text-xs font-bold opacity-50 hover:opacity-100"
            >
              <Globe size={16} />
              {i18n.language === 'ar' ? 'EN' : 'AR'}
            </button>
            {user ? (
              <button onClick={() => signOut(auth)} className="opacity-50 hover:opacity-100 hover:text-red-600"><LogOut size={20} /></button>
            ) : (
              <button onClick={() => setView('dashboard')} className="text-xs font-bold">{t('login')}</button>
            )}
          </div>
        </div>
      </nav>

      {/* Navigation - Bottom (Mobile) */}
      <MobileNav view={view} setView={setView} t={t} />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12 flex items-end justify-between">
                <div>
                  <h2 className="text-4xl font-serif font-bold">{t('write')}</h2>
                  <p className="text-black/50">{t('slogan')}</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setView('ai-books')} 
                    className="flex h-12 px-6 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 gap-2"
                    title={t('ai_book_writer', 'كاتب الكتب بالذكاء الاصطناعي')}
                  >
                    <Sparkles size={20} />
                    <span className="text-sm font-bold">{t('ai_writer', 'تأليف كتاب بالذكاء')}</span>
                  </button>
                  <button 
                    onClick={() => setShowNewNovelModal(true)} 
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                    title={t('write')}
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>

              {showNewNovelModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white p-8">
                    <h3 className="mb-6 text-2xl font-bold">{t('new_novel')}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('novel_title')}</label>
                        <input 
                          value={newNovelTitle} 
                          onChange={e => setNewNovelTitle(e.target.value)} 
                          className="monochrome-input" 
                          placeholder={t('novel_title_placeholder')} 
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('language', 'اللغة')}</label>
                          <select 
                            value={newNovelLanguage} 
                            onChange={e => setNewNovelLanguage(e.target.value as any)} 
                            className="monochrome-input"
                          >
                            <option value="ar">العربية</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('violence_level', 'مستوى العنف')}</label>
                          <select 
                            value={newNovelViolence} 
                            onChange={e => setNewNovelViolence(e.target.value as any)} 
                            className="monochrome-input"
                          >
                            <option value="none">{t('violence_none', 'بدون عنف')}</option>
                            <option value="low">{t('violence_low', 'منخفض')}</option>
                            <option value="medium">{t('violence_medium', 'متوسط')}</option>
                            <option value="high">{t('violence_high', 'دموي/عالي')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('moral_tone', 'التوجه الأخلاقي')}</label>
                        <select 
                          value={newNovelMoral} 
                          onChange={e => setNewNovelMoral(e.target.value as any)} 
                          className="monochrome-input"
                        >
                          <option value="moral">{t('moral_high', 'أخلاقي/تربوي')}</option>
                          <option value="neutral">{t('moral_neutral', 'محايد')}</option>
                          <option value="dark">{t('moral_dark', 'سوداوي/غير أخلاقي')}</option>
                        </select>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button onClick={createNovel} className="monochrome-button flex-grow">{t('start_writing')}</button>
                        <button onClick={() => setShowNewNovelModal(false)} className="monochrome-button-outline flex-grow">{t('cancel')}</button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {novels.map(novel => (
                  <div key={novel.id} className="monochrome-card group relative flex flex-col justify-between">
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-widest text-black/40">{t(novel.genre)}</span>
                          {novel.status === 'published' && <span className="text-[10px] font-bold text-emerald-600">{t('published')}</span>}
                        </div>
                        <button onClick={() => deleteNovel(novel.id)} className="opacity-0 transition-all group-hover:opacity-100 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <h3 className="mb-2 text-xl font-bold">{novel.title}</h3>
                      <p className="line-clamp-3 text-sm text-black/60">{novel.summary || t('no_summary_yet')}</p>
                      
                      <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-black/30">
                        <div className="flex items-center gap-1"><Eye size={12} /> {novel.viewsCount || 0}</div>
                        <div className="flex items-center gap-1"><Heart size={12} /> {novel.likesCount || 0}</div>
                        <div className="flex items-center gap-1"><Share2 size={12} /> {novel.sharesCount || 0}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedNovel(novel);
                        setView('novel');
                      }}
                      className="mt-6 flex items-center gap-2 text-sm font-bold underline underline-offset-4"
                    >
                      {t('open_novel')} <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
                {novels.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-black/30">
                    <Logo size={80} className="mb-4 opacity-20" />
                    <p>{t('no_content')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'explore' && (
            <motion.div 
              key="explore"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-12">
                <h2 className="text-4xl font-serif font-bold">{t('explore')}</h2>
                <p className="text-black/50">{t('explore_slogan')}</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {publicNovels.map(novel => (
                  <div key={novel.id} className="monochrome-card flex flex-col justify-between overflow-hidden p-0">
                    <div className="h-48 w-full bg-black/5 flex items-center justify-center border-b border-black/5">
                      {novel.coverImage ? (
                        <img src={novel.coverImage} alt={novel.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Logo size={48} className="opacity-10" />
                      )}
                    </div>
                    <div className="p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-black/40">{t(novel.genre)}</span>
                        <button 
                          onClick={() => {
                            setSelectedProfileUid(novel.authorUid);
                            setView('profile');
                          }}
                          className="text-[10px] font-bold opacity-30 hover:opacity-100 hover:underline"
                        >
                          {novel.authorName}
                        </button>
                      </div>
                      <h3 className="mb-2 text-xl font-bold">{novel.title}</h3>
                      <p className="line-clamp-2 text-sm text-black/60">{novel.summary || t('no_summary')}</p>
                      
                      <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-black/30">
                        <div className="flex items-center gap-1"><Eye size={12} /> {novel.viewsCount || 0}</div>
                        <div className="flex items-center gap-1"><Heart size={12} /> {novel.likesCount || 0}</div>
                        <div className="flex items-center gap-1"><Share2 size={12} /> {novel.sharesCount || 0}</div>
                      </div>

                      <button 
                        onClick={() => {
                          setSelectedNovel(novel);
                          setView('reader');
                        }}
                        className="mt-6 flex items-center gap-2 text-sm font-bold underline underline-offset-4"
                      >
                        {t('read_novel')} <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {publicNovels.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-black/30">
                    <Eye size={48} strokeWidth={1} className="mb-4" />
                    <p>{t('no_published_novels')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'library' && (
            <LibraryView 
              library={library} 
              novels={[...publicNovels, ...novels]} 
              readingProgress={readingProgress}
              onOpenNovel={(novel) => {
                setSelectedNovel(novel);
                setView('reader');
              }}
            />
          )}

          {view === 'ai-books' && (
            <AIBookWriter 
              onBack={() => setView('dashboard')} 
              onSave={handleSaveAIBook}
              showToast={showToast}
            />
          )}

          {view === 'novel' && selectedNovel && (
            <NovelDetail 
              novel={selectedNovel} 
              isAuthor={user?.uid === selectedNovel.authorUid}
              isAdmin={isAdmin}
              profile={userProfile}
              onEditChapter={(ch) => {
                setSelectedChapter(ch);
                setView('editor');
              }}
              onManageCharacters={() => setView('characters')}
              onDeleteNovel={() => deleteNovel(selectedNovel.id)}
              setView={setView}
              showToast={showToast}
              onAddToLibrary={() => addToLibrary(selectedNovel.id)}
              onRemoveFromLibrary={() => removeFromLibrary(selectedNovel.id)}
              isInLibrary={library.some(l => l.novelId === selectedNovel.id)}
            />
          )}

          {view === 'reader' && selectedNovel && (
            <Reader 
              novel={selectedNovel} 
              onBack={() => setView('novel')} 
              onStatUpdate={(stat) => incrementStat(selectedNovel.id, stat)}
              onOpenProfile={(uid) => {
                setSelectedProfileUid(uid);
                setView('profile');
              }}
              isFollowing={follows.some(f => f.followedUid === selectedNovel.authorUid)}
              onFollow={() => followAuthor(selectedNovel.authorUid)}
              onUnfollow={() => unfollowAuthor(selectedNovel.authorUid)}
              onUpdateProgress={updateReadingProgress}
              onAddToLibrary={() => addToLibrary(selectedNovel.id)}
              onRemoveFromLibrary={() => removeFromLibrary(selectedNovel.id)}
              isInLibrary={library.some(l => l.novelId === selectedNovel.id)}
              lastReadChapterId={readingProgress.find(p => p.novelId === selectedNovel.id)?.lastChapterId}
              currentUser={user}
              isAdmin={isAdmin}
              onDeleteComment={deleteComment}
              showToast={showToast}
            />
          )}

          {view === 'profile' && selectedProfileUid && (
            <ProfileView 
              uid={selectedProfileUid}
              currentUser={user}
              onBack={() => setView('explore')}
              onOpenNovel={(novel) => {
                setSelectedNovel(novel);
                setView('reader');
              }}
              onFollow={followAuthor}
              onUnfollow={unfollowAuthor}
              isFollowing={follows.some(f => f.followedUid === selectedProfileUid)}
              showToast={showToast}
            />
          )}

          {view === 'following' && (
            <FollowingView 
              profiles={followingProfiles}
              onOpenProfile={(uid) => {
                setSelectedProfileUid(uid);
                setView('profile');
              }}
              onBack={() => setView('dashboard')}
              currentUser={user}
            />
          )}

          {view === 'editor' && selectedNovel && selectedChapter && (
            <Editor 
              novel={selectedNovel} 
              chapter={selectedChapter} 
              onBack={() => setView('novel')} 
              showToast={showToast}
              setConfirmModal={setConfirmModal}
            />
          )}

          {view === 'characters' && selectedNovel && (
            <CharacterManager 
              novel={selectedNovel} 
              onBack={() => setView('novel')} 
            />
          )}

          {view === 'settings' && userProfile && (
            <SettingsView 
              profile={userProfile} 
              onUpdateProfile={async (data) => {
                const userRef = doc(db, 'users', user!.uid);
                const publicRef = doc(db, 'users_public', user!.uid);
                try {
                  let photoURL = data.photoURL;
                  if (photoURL && photoURL.startsWith('data:image/')) {
                    try {
                      // Always compress first to ensure it's small enough for Firestore fallback
                      const compressed = await resizeAndCompressImage(photoURL, 400, 400, 0.7);
                      try {
                        photoURL = await uploadBase64Image(compressed, `avatars/${user!.uid}.png`);
                      } catch (storageErr) {
                        console.warn("Storage upload failed, falling back to Firestore base64", storageErr);
                        photoURL = compressed;
                      }
                    } catch (compressErr) {
                      console.error("Compression failed", compressErr);
                    }
                  }

                  const updateData = {
                    ...data,
                    photoURL,
                    updatedAt: serverTimestamp()
                  };
                  await updateDoc(userRef, updateData);
                  
                  // Only update public fields in users_public
                  const publicData = {
                    displayName: data.displayName,
                    photoURL,
                    bio: data.bio,
                    updatedAt: serverTimestamp()
                  };
                  // Remove undefined fields to avoid errors
                  Object.keys(publicData).forEach(key => (publicData as any)[key] === undefined && delete (publicData as any)[key]);
                  await setDoc(publicRef, publicData, { merge: true });

                  // Sync denormalized data in novels
                  const novelsQ = query(collection(db, 'novels'), where('authorUid', '==', user!.uid));
                  const novelsSnap = await getDocs(novelsQ);
                  const syncPromises = novelsSnap.docs.map(novelDoc => 
                    updateDoc(novelDoc.ref, {
                      authorName: data.displayName,
                      authorPhoto: photoURL
                    })
                  );
                  await Promise.all(syncPromises);
                } catch (e) {
                  handleFirestoreError(e, OperationType.UPDATE, `users/${user!.uid}`);
                }
              }}
              showToast={showToast}
            />
          )}

          {view === 'search' && (
            <SearchView 
              query={searchQuery}
              results={searchResults}
              loading={searching}
              onOpenNovel={(n) => {
                setSelectedNovel(n);
                setView('reader');
              }}
              onOpenProfile={(uid) => {
                setSelectedProfileUid(uid);
                setView('profile');
              }}
            />
          )}
        </AnimatePresence>
      </main>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      <div id="pdf-export-content" className="fixed top-0 left-0 -z-[100] overflow-hidden pointer-events-none" style={{ width: '800px' }}>
        {/* This div will be populated dynamically during PDF export */}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 rounded-full px-6 py-3 text-sm font-bold shadow-2xl backdrop-blur-md ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-black text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MobileNav = ({ view, setView, t }: { view: string, setView: (v: any) => void, t: any }) => (
  <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-black/5 bg-white/80 p-2 backdrop-blur-xl md:hidden">
    <button 
      onClick={() => setView('explore')} 
      className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'explore' ? 'text-black' : 'text-black/30'}`}
    >
      <Globe size={20} />
      <span className="text-[10px] font-bold">{t('explore')}</span>
    </button>
    <button 
      onClick={() => setView('library')} 
      className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'library' ? 'text-black' : 'text-black/30'}`}
    >
      <Bookmark size={20} />
      <span className="text-[10px] font-bold">{t('library')}</span>
    </button>
    <button 
      onClick={() => setView('dashboard')} 
      className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'dashboard' ? 'text-black' : 'text-black/30'}`}
    >
      <PenTool size={20} />
      <span className="text-[10px] font-bold">{t('write')}</span>
    </button>
    <button 
      onClick={() => setView('search')} 
      className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'search' ? 'text-black' : 'text-black/30'}`}
    >
      <Search size={20} />
      <span className="text-[10px] font-bold">{t('search')}</span>
    </button>
    <button 
      onClick={() => setView('profile')} 
      className={`flex flex-col items-center gap-1 p-2 transition-all ${view === 'profile' ? 'text-black' : 'text-black/30'}`}
    >
      <UserIcon size={20} />
      <span className="text-[10px] font-bold">{t('profile')}</span>
    </button>
  </div>
);

// --- Sub-Components ---

const NovelDetail = ({ novel, isAuthor, isAdmin, profile, onEditChapter, onManageCharacters, onDeleteNovel, setView, showToast, onAddToLibrary, onRemoveFromLibrary, isInLibrary }: { 
  novel: Novel, 
  isAuthor: boolean,
  isAdmin: boolean,
  profile: UserProfile | null,
  onEditChapter: (ch: Chapter) => void, 
  onManageCharacters: () => void,
  onDeleteNovel: () => void,
  setView: (v: 'dashboard' | 'explore' | 'novel' | 'editor' | 'characters' | 'settings' | 'reader' | 'profile' | 'following' | 'search' | 'library') => void,
  showToast: (msg: string, type?: 'success' | 'error') => void,
  onAddToLibrary?: () => void,
  onRemoveFromLibrary?: () => void,
  isInLibrary?: boolean
}) => {
  const { t } = useTranslation();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeTab, setActiveTab] = useState<'chapters' | 'ai'>('chapters');
  const [aiPlot, setAiPlot] = useState('');
  const [copiedPlot, setCopiedPlot] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isBlurred, setIsBlurred] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  
  const privacyActive = !isAuthor && !isAdmin;

  const handleSyncManual = async () => {
    setSyncing(true);
    try {
      const chaptersSnap = await getDocs(collection(db, `novels/${novel.id}/chapters`));
      const chaptersData = chaptersSnap.docs.map(d => d.data());

      const response = await fetch('/api/sync/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novel,
          chapters: chaptersData,
          authorProfile: {
            displayName: profile?.displayName,
            photoURL: profile?.photoURL
          }
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      showToast(t('sync_success'), 'success');
    } catch (e: any) {
      console.error(e);
      showToast(t('sync_error') + ' ' + e.message, 'error');
    }
    setSyncing(false);
  };

  useEffect(() => {
    if (!privacyActive) return;

    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // Prevent context menu (right click)
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [privacyActive]);

  const handleCopyPlot = () => {
    if (privacyActive) {
      showToast(t('copy_forbidden'), 'error');
      return;
    }
    if (aiPlot) {
      navigator.clipboard.writeText(aiPlot);
      setCopiedPlot(true);
      setTimeout(() => setCopiedPlot(false), 2000);
    }
  };

  const handleCopySummary = () => {
    if (privacyActive) {
      showToast(t('copy_forbidden'), 'error');
      return;
    }
    if (novel.summary) {
      navigator.clipboard.writeText(novel.summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleGenerateShortSummary = async () => {
    setGeneratingSummary(true);
    try {
      const summary = await generateShortSummary(
        novel.title,
        novel.genre,
        novel.summary,
        novel.language || 'ar'
      );
      if (summary) {
        await updateDoc(doc(db, 'novels', novel.id), {
          summary: summary,
          updatedAt: serverTimestamp()
        });
        showToast(t('summary_generated_success', 'تم توليد الملخص بنجاح!'), 'success');
      }
    } catch (e) {
      console.error(e);
      showToast(t('error_generating_summary', 'حدث خطأ أثناء توليد الملخص.'), 'error');
    }
    setGeneratingSummary(false);
  };

  const handleGenerateCover = async () => {
    setGeneratingCover(true);
    const path = `novels/${novel.id}`;
    try {
      let coverUrl = await generateCover(novel.title, novel.summary, novel.violenceLevel || 'none', novel.moralTone || 'neutral');
      if (coverUrl && coverUrl.startsWith('data:image/')) {
        try {
          // Compress cover image (larger than avatar but still within limits)
          const compressed = await resizeAndCompressImage(coverUrl, 800, 1000, 0.7);
          try {
            coverUrl = await uploadBase64Image(compressed, `covers/${novel.id}.png`);
          } catch (storageErr) {
            console.warn("Storage upload failed, falling back to Firestore base64", storageErr);
            coverUrl = compressed;
          }
        } catch (compressErr) {
          console.error("Compression failed", compressErr);
        }
      }
      if (coverUrl) {
        await updateDoc(doc(db, 'novels', novel.id), {
          coverImage: coverUrl,
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
      showToast(t('error_generating_cover', 'حدث خطأ أثناء توليد الغلاف.'), 'error');
    }
    setGeneratingCover(false);
  };
  const [confirmDeleteChapter, setConfirmDeleteChapter] = useState<{ isOpen: boolean, chapterId: string | null }>({
    isOpen: false,
    chapterId: null
  });

  useEffect(() => {
    const q = query(collection(db, `novels/${novel.id}/chapters`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChapters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `novels/${novel.id}/chapters`);
    });
    return () => unsubscribe();
  }, [novel.id]);

  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;
    const path = `novels/${novel.id}/chapters`;
    try {
      await addDoc(collection(db, path), {
        novelId: novel.id,
        title: newChapterTitle.trim(),
        content: '',
        description: '',
        order: chapters.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewChapterTitle('');
      setShowAddChapter(false);
    } catch (e) { 
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const deleteChapter = async (chapterId: string) => {
    const path = `novels/${novel.id}/chapters/${chapterId}`;
    try {
      await deleteDoc(doc(db, `novels/${novel.id}/chapters`, chapterId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  const handleGeneratePlot = async () => {
    setGenerating(true);
    try {
      let previousSummary = '';
      if (novel.previousPartId) {
        const prevDoc = await getDoc(doc(db, 'novels', novel.previousPartId));
        if (prevDoc.exists()) {
          previousSummary = prevDoc.data().summary || '';
        }
      }

      const plot = await generatePlot(
        novel.title, 
        novel.genre, 
        novel.summary, 
        novel.language || 'ar',
        novel.violenceLevel || 'none',
        novel.moralTone || 'neutral',
        previousSummary
      );
      setAiPlot(plot || '');
    } catch (e) { 
      console.error(e);
      showToast(t('error_generating_plot', 'حدث خطأ أثناء توليد الحبكة.'), 'error');
    }
    setGenerating(false);
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    if (url.startsWith('data:image/')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error converting image to base64:", e);
      return '';
    }
  };

  const exportToPDF = async () => {
    setExportingPDF(true);
    const toastId = showToast(t('exporting_pdf', 'جاري تجهيز الرواية بتنسيق احترافي...'), 'success');
    
    try {
      const element = document.getElementById('pdf-export-content');
      if (!element) throw new Error('Export element not found');

      (window as any).html2canvas = html2canvas;

      const isRtl = novel.language === 'ar';
      
      const formatNumber = (n: number) => {
        if (!isRtl) return n.toString();
        return n.toString().replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
      };

      const getLabel = (ar: string, en: string) => isRtl ? ar : en;

      // Map CSS variables to actual font names
      const fontMap: Record<string, string> = {
        'var(--font-serif)': '"Playfair Display", serif',
        'var(--font-sans)': '"Inter", sans-serif',
        'var(--font-amiri)': '"Amiri", serif',
        'var(--font-cairo)': '"Cairo", sans-serif',
        'var(--font-lalezar)': '"Lalezar", cursive',
        'var(--font-tajawal)': '"Tajawal", sans-serif',
        'var(--font-roboto)': '"Roboto", sans-serif',
        'var(--font-merriweather)': '"Merriweather", serif'
      };

      const resolvedFont = fontMap[novel.fontFamily || ''] || (isRtl ? '"Amiri", serif' : '"Playfair Display", serif');

      // Set element to exactly A4 width in points (595pt) to avoid scaling issues
      element.innerHTML = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap');
          
          .book-container {
            font-family: ${resolvedFont};
            color: #000;
            background: white;
            width: 595px; /* Exactly A4 width in points */
            box-sizing: border-box;
            line-height: 1.8;
            direction: ${isRtl ? 'rtl' : 'ltr'};
            text-align: justify;
            padding: 0;
            margin: 0;
          }

          .cover-page {
            height: 842px; /* A4 height in points */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            padding: 60px 40px;
            page-break-after: always;
          }

          .cover-image {
            max-width: 300px;
            max-height: 400px;
            object-fit: contain;
          }

          .cover-title {
            font-size: 36pt;
            font-weight: bold;
            margin: 20px 0;
          }

          .cover-author-box {
            background: #1a1a1a;
            color: white;
            padding: 8pt 30pt;
            border-radius: 20pt;
            font-size: 14pt;
            font-weight: bold;
          }

          .title-page {
            height: 842px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 60px;
            page-break-after: always;
            position: relative;
          }

          .title-page .novel-label {
            position: absolute;
            top: 60px;
            ${isRtl ? 'right' : 'left'}: 60px;
            font-size: 16pt;
          }

          .title-page h1 { font-size: 42pt; margin-bottom: 10px; font-weight: bold; }
          .title-page .subtitle { font-size: 14pt; margin-bottom: 60px; opacity: 0.8; }
          .title-page .author { font-size: 18pt; font-weight: bold; margin-bottom: 100px; }
          .title-page .publisher { font-size: 11pt; opacity: 0.6; position: absolute; bottom: 80px; }

          .inner-page {
            padding: 60px 70px;
            min-height: 842px;
          }

          .chapter-header {
            text-align: center;
            margin-bottom: 60px;
            padding-top: 60px;
          }

          .chapter-number-large {
            font-size: 36pt;
            font-weight: bold;
            display: block;
          }

          .content-body {
            font-size: 13pt;
            line-height: 1.8;
          }

          .content-body p {
            margin: 0;
            text-indent: 2.5em;
          }

          .content-body p:first-of-type {
            text-indent: 0;
            margin-top: 20px;
          }

          .content-body p.section-break {
            text-indent: 0;
            text-align: center;
            margin: 30px 0;
            font-weight: bold;
            font-size: 16pt;
          }

          .summary-page {
            page-break-after: always;
            padding: 100px 80px;
            text-align: center;
          }

          .summary-label {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 30px;
            display: block;
            opacity: 0.3;
          }

          .summary-text {
            font-size: 14pt;
            line-height: 1.8;
            font-style: italic;
          }
        </style>

        <div class="book-container">
          <div class="cover-page">
            ${novel.coverImage ? `<img src="${await getBase64FromUrl(novel.coverImage)}" class="cover-image" />` : '<div style="height:200px"></div>'}
            <div>
              <h1 class="cover-title">${novel.title}</h1>
              <p style="font-size: 14pt; opacity: 0.7;">${novel.summary?.split('.')[0] || ''}</p>
            </div>
            <div class="cover-author-box">${novel.authorName || getLabel('كاتب مجهول', 'Unknown Author')}</div>
          </div>

          <div class="title-page">
            <div class="novel-label">${getLabel('رواية', 'Novel')}</div>
            <h1>${novel.title}</h1>
            <div class="subtitle">${novel.summary?.split('.')[0] || ''}</div>
            <div class="author">${novel.authorName || getLabel('كاتب مجهول', 'Unknown Author')}</div>
            <div class="publisher">${getLabel('أبـابـيـل للـنـشـر الإلكتروني', 'Ababil Electronic Publishing')}</div>
          </div>

          <div class="inner-page summary-page">
            <span class="summary-label">${getLabel('الملخص', 'Summary')}</span>
            <div class="summary-text">${novel.summary}</div>
          </div>

          ${chapters.map((chapter, index) => `
            <div class="inner-page" style="page-break-before: always;">
              <div class="chapter-header">
                <span class="chapter-number-large">${formatNumber(index + 1)}</span>
              </div>
              <div class="content-body">
                ${chapter.content.split('\n').filter(p => p.trim()).map(p => {
                  const trimmed = p.trim();
                  if (trimmed === '***' || trimmed === '---' || (trimmed.length < 20 && !trimmed.startsWith('-'))) {
                     return `<p class="section-break">${trimmed}</p>`;
                  }
                  return `<p>${trimmed}</p>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Wait for font loading
      await new Promise(resolve => setTimeout(resolve, 3500));

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      await new Promise<void>((resolve, reject) => {
        doc.html(element, {
          html2canvas: {
            scale: 1, // 1:1 since we set element to 595px
            useCORS: true,
            logging: false,
            letterRendering: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          },
          callback: function (doc) {
            try {
              const pageCount = doc.getNumberOfPages();
              for (let i = 3; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`${formatNumber(i - 2)}`, 297, 815, { align: 'center' });
              }

              doc.save(`${novel.title}.pdf`);
              showToast(t('saved'), 'success');
              setExportingPDF(false);
              element.innerHTML = '';
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          x: 0,
          y: 0,
          width: 595,
          windowWidth: 595,
          autoPaging: 'text'
        });
      });
      
    } catch (e: any) {
      console.error("PDF Export Error:", e);
      showToast(t('error_occurred'), 'error');
      setExportingPDF(false);
    }
  };

  const updateNovelSettings = async (field: string, value: string) => {
    try {
      await updateDoc(doc(db, 'novels', novel.id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `novels/${novel.id}`);
    }
  };

  const createSequel = async () => {
    setGenerating(true);
    const path = 'novels';
    try {
      const sequelTitle = `${novel.title}${t('part_two_suffix')}`;
      const newNovelRef = await addDoc(collection(db, path), {
        authorUid: auth.currentUser!.uid,
        authorName: novel.authorName,
        authorPhoto: novel.authorPhoto,
        title: sequelTitle,
        genre: novel.genre,
        summary: `${t('sequel_to', 'تكملة لـ')}: ${novel.title}. ${novel.summary}`,
        status: 'draft',
        likesCount: 0,
        viewsCount: 0,
        sharesCount: 0,
        language: novel.language || 'ar',
        violenceLevel: novel.violenceLevel || 'none',
        moralTone: novel.moralTone || 'neutral',
        fontFamily: novel.fontFamily || 'var(--font-serif)',
        fontSize: novel.fontSize || '1.125rem',
        textAlign: novel.textAlign || 'right',
        lineHeight: novel.lineHeight || '1.75',
        previousPartId: novel.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(t('sequel_created', 'تم إنشاء الجزء الثاني بنجاح!'), 'success');
      // Navigate to the new novel
      // We need to trigger a refresh or just let the user find it in dashboard
      // For better UX, we could set the active novel to the new one
      // But we don't have direct access to setNovel here, it's passed as a prop
      // Let's just go back to dashboard
      setView('dashboard');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
    setGenerating(false);
  };

  const togglePublish = async (authorName?: string, coverImage?: string) => {
    const isPublishing = novel.status !== 'published';
    const newStatus = isPublishing ? 'published' : 'draft';
    const path = `novels/${novel.id}`;
    
    const updateData: any = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };

    if (isPublishing && authorName) {
      updateData.authorName = authorName;
      if (coverImage) updateData.coverImage = coverImage;
    }

    try {
      await updateDoc(doc(db, 'novels', novel.id), updateData);
      
      // Automatic Sync if enabled in user profile
      if (isPublishing) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
        const userData = userDoc.data();
        
        if (userData?.autoSync) {
          // Fetch chapters for sync
          const chaptersSnap = await getDocs(collection(db, `novels/${novel.id}/chapters`));
          const chapters = chaptersSnap.docs.map(d => d.data());
          
          await fetch('/api/sync/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              novel: { ...novel, ...updateData },
              chapters,
              authorProfile: {
                displayName: userData.displayName,
                photoURL: userData.photoURL
              }
            })
          });
        }
      }

      setShowPublishModal(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className={`relative ${privacyActive ? 'select-none' : ''} privacy-protected`}
    >
      {isBlurred && privacyActive && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-2xl">
          <div className="text-center p-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black/5 text-black/20">
              <Lock size={40} />
            </div>
            <h2 className="mb-2 text-2xl font-bold">{t('content_hidden_privacy', 'تم إخفاء المحتوى للخصوصية')}</h2>
            <p className="text-black/40">{t('return_to_page_warning', 'يرجى العودة إلى الصفحة للمتابعة. لقطات الشاشة وتسجيل الشاشة محظور.')}</p>
          </div>
        </div>
      )}
      <div className="mb-12 flex flex-col gap-8 md:flex-row md:items-start">
        <div className="relative group">
          <div className="h-64 w-48 flex-shrink-0 bg-black/5 flex items-center justify-center border border-black/10 overflow-hidden shadow-sm">
            {novel.coverImage ? (
              <img src={novel.coverImage} alt={novel.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Logo size={64} className="opacity-10" />
            )}
          </div>
          {isAuthor && (
            <button 
              onClick={handleGenerateCover}
              disabled={generatingCover}
              title={t('generate_ai_cover', 'توليد غلاف بالذكاء الاصطناعي')}
              className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
            >
              {generatingCover ? (
                <div className="h-4 w-4 animate-spin border-2 border-white border-t-transparent"></div>
              ) : (
                <Sparkles size={16} />
              )}
            </button>
          )}
        </div>
        <div className="flex-grow">
          <div className="mb-4 flex items-center gap-2">
            <span className="bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">{novel.genre}</span>
            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${novel.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {novel.status === 'published' ? t('published') : t('draft')}
            </span>
          </div>
          <h2 className="mb-2 text-5xl font-serif font-bold tracking-tighter">{novel.title}</h2>
          {novel.authorName && <p className="mb-4 text-sm opacity-50">{t('by_author', 'بقلم')}: {novel.authorName}</p>}
          
          <div className="mb-4 relative group">
            <p className="text-sm text-black/60 line-clamp-3 italic">
              {novel.summary}
            </p>
            {!privacyActive && (
              <div className="absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                <button 
                  onClick={handleCopySummary}
                  className="flex items-center gap-1 rounded-full bg-white border border-black/10 px-2 py-1 text-[10px] font-bold shadow-sm hover:bg-black hover:text-white"
                >
                  {copiedSummary ? <Check size={10} /> : <Copy size={10} />}
                  {copiedSummary ? t('copied') : t('copy')}
                </button>
                {isAuthor && (
                  <button 
                    onClick={handleGenerateShortSummary}
                    disabled={generatingSummary}
                    className="flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-1 text-[10px] font-bold text-purple-600 shadow-sm hover:bg-purple-600 hover:text-white disabled:opacity-50"
                  >
                    {generatingSummary ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    {t('ai_summary', 'ملخص ذكي')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mb-6 flex items-center gap-6 text-xs font-bold opacity-40">
            <div className="flex items-center gap-2"><Eye size={16} /> {novel.viewsCount || 0} {t('views')}</div>
            <div className="flex items-center gap-2"><Heart size={16} /> {novel.likesCount || 0} {t('likes')}</div>
            <div className="flex items-center gap-2"><Share2 size={16} /> {novel.sharesCount || 0} {t('shares')}</div>
          </div>

          <div className="flex flex-wrap gap-4">
            {(isAuthor || isAdmin) && (
              <>
                {isAuthor && (
                  <>
                    <button onClick={onManageCharacters} className="monochrome-button-outline py-2 text-sm">
                      <Users size={16} /> {t('characters')}
                    </button>
                    <button 
                      onClick={() => novel.status === 'published' ? togglePublish() : setShowPublishModal(true)} 
                      className={`monochrome-button py-2 text-sm ${novel.status === 'published' ? 'bg-white text-black border border-black hover:bg-black hover:text-white' : ''}`}
                    >
                      {novel.status === 'published' ? <X size={16} /> : <Globe size={16} />}
                      {novel.status === 'published' ? t('unpublish', 'إلغاء النشر') : t('publish_novel', 'نشر الرواية')}
                    </button>
                    {novel.status === 'published' && profile?.partnerAppUrl && (
                      <button 
                        onClick={handleSyncManual}
                        disabled={syncing}
                        className="monochrome-button-outline py-2 text-sm flex items-center gap-2"
                      >
                        {syncing ? <div className="h-4 w-4 animate-spin border-2 border-black border-t-transparent rounded-full" /> : <RefreshCw size={16} />}
                        {syncing ? t('syncing') : t('sync_now')}
                      </button>
                    )}
                  </>
                )}
                <button onClick={onDeleteNovel} className="monochrome-button-outline py-2 text-sm text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 size={16} /> {t('delete_novel', 'حذف الرواية')}
                </button>
              </>
            )}
            <button 
              onClick={() => {
                setView('reader');
              }}
              className="monochrome-button py-2 text-sm"
            >
              <BookOpen size={16} /> {t('read', 'قراءة')}
            </button>
            <button 
              onClick={() => isInLibrary ? onRemoveFromLibrary?.() : onAddToLibrary?.()}
              className={`monochrome-button-outline py-2 text-sm flex items-center gap-2 ${isInLibrary ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ''}`}
            >
              <Bookmark size={16} fill={isInLibrary ? "currentColor" : "none"} />
              {isInLibrary ? t('in_library') : t('add_to_library')}
            </button>
            <button 
              onClick={exportToPDF}
              disabled={exportingPDF}
              className="monochrome-button-outline py-2 text-sm flex items-center gap-2"
            >
              {exportingPDF ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              {exportingPDF ? t('exporting_pdf') : t('download_pdf')}
            </button>
            {isAuthor && (
              <>
                <button 
                  onClick={createSequel}
                  disabled={generating}
                  className="monochrome-button-outline py-2 text-sm flex items-center gap-2"
                >
                  <PlusCircle size={16} />
                  {t('create_sequel')}
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="monochrome-button-outline py-2 text-sm flex items-center gap-2"
                >
                  <Settings size={16} />
                  {t('settings')}
                </button>
              </>
            )}
          </div>

          {showSettings && isAuthor && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-black/5 pt-6 overflow-hidden"
            >
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-50">{t('language')}</label>
                <select 
                  value={novel.language || 'ar'} 
                  onChange={e => updateNovelSettings('language', e.target.value)}
                  className="monochrome-input text-xs py-1"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-50">{t('violence_level')}</label>
                <select 
                  value={novel.violenceLevel || 'none'} 
                  onChange={e => updateNovelSettings('violenceLevel', e.target.value)}
                  className="monochrome-input text-xs py-1"
                >
                  <option value="none">{t('violence_none')}</option>
                  <option value="low">{t('violence_low')}</option>
                  <option value="medium">{t('violence_medium')}</option>
                  <option value="high">{t('violence_high')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-50">{t('moral_tone')}</label>
                <select 
                  value={novel.moralTone || 'neutral'} 
                  onChange={e => updateNovelSettings('moralTone', e.target.value)}
                  className="monochrome-input text-xs py-1"
                >
                  <option value="moral">{t('moral_high')}</option>
                  <option value="neutral">{t('moral_neutral')}</option>
                  <option value="dark">{t('moral_dark')}</option>
                </select>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mb-8 flex border-b border-black/10">
        <button 
          onClick={() => setActiveTab('chapters')}
          className={`px-6 py-3 text-sm font-bold transition-all ${activeTab === 'chapters' ? 'border-b-2 border-black' : 'opacity-40'}`}
        >
          {t('chapters')}
        </button>
        <button 
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${activeTab === 'ai' ? 'border-b-2 border-black' : 'opacity-40'}`}
        >
          <Sparkles size={14} /> {t('ai_plot_generator', 'مولد الحبكة AI')}
        </button>
      </div>

      {activeTab === 'chapters' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">{chapters.length} {t('chapter_count', 'فصل')}</h3>
            <button onClick={() => setShowAddChapter(true)} className="monochrome-button py-2 text-sm">
              <Plus size={16} /> {t('new_chapter', 'فصل جديد')}
            </button>
          </div>

          {showAddChapter && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white p-8">
                <h3 className="mb-6 text-2xl font-bold">{t('new_chapter')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('chapter_title', 'عنوان الفصل')}</label>
                    <input 
                      value={newChapterTitle} 
                      onChange={e => setNewChapterTitle(e.target.value)} 
                      className="monochrome-input" 
                      placeholder={t('example_beginning', 'مثال: البداية')} 
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button onClick={addChapter} className="monochrome-button flex-grow">{t('add', 'إضافة')}</button>
                    <button onClick={() => setShowAddChapter(false)} className="monochrome-button-outline flex-grow">{t('cancel', 'إلغاء')}</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
          <div className="grid gap-4">
            {chapters.map(ch => (
              <div key={ch.id} className="monochrome-card flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className="font-serif text-2xl text-black/20">{ch.order}</span>
                  <span className="font-bold">{ch.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEditChapter(ch)} className="monochrome-button-outline px-4 py-2 text-xs">{t('edit_chapter', 'تحرير')}</button>
                  <button 
                    onClick={() => setConfirmDeleteChapter({ isOpen: true, chapterId: ch.id })} 
                    className="p-2 text-black/20 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {chapters.length === 0 && (
              <div className="py-12 text-center text-black/30">{t('no_chapters_yet', 'لا توجد فصول بعد.')}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="monochrome-card">
          {!aiPlot ? (
            <div className="py-12 text-center">
              <Sparkles size={48} className="mx-auto mb-4 text-black/10" />
              <h4 className="mb-2 font-bold">{t('need_inspiration', 'هل تحتاج إلى إلهام؟')}</h4>
              <p className="mb-6 text-sm text-black/50">{t('ai_inspiration_message', 'سيقوم الذكاء الاصطناعي باقتراح حبكة كاملة بناءً على عنوان روايتك.')}</p>
              <button 
                onClick={handleGeneratePlot} 
                disabled={generating}
                className="monochrome-button mx-auto"
              >
                {generating ? t('generating_ai', 'جاري التوليد...') : t('generate_suggestion', 'توليد مقترح كامل')}
              </button>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <div className="mb-4 flex items-center justify-between border-b border-black/10 pb-4">
                <h4 className="font-bold">{t('ai_plot_suggestion', 'مقترح الحبكة الذكي')}</h4>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleCopyPlot} 
                    className="flex items-center gap-1 text-xs text-black/60 hover:text-black"
                  >
                    {copiedPlot ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copiedPlot ? t('copied') : t('copy_text', 'نسخ النص')}
                  </button>
                  <button onClick={() => setAiPlot('')} className="text-xs underline">{t('regenerate', 'إعادة التوليد')}</button>
                </div>
              </div>
              <Markdown>{aiPlot}</Markdown>
            </div>
          )}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmDeleteChapter.isOpen}
        onClose={() => setConfirmDeleteChapter({ isOpen: false, chapterId: null })}
        onConfirm={() => {
          if (confirmDeleteChapter.chapterId) {
            deleteChapter(confirmDeleteChapter.chapterId);
          }
        }}
        title={t('delete_chapter_confirm_title', 'حذف الفصل')}
        message={t('delete_chapter_confirm_message', 'هل أنت متأكد من حذف هذا الفصل؟ لا يمكن التراجع عن هذه العملية.')}
      />

      <PublishModal 
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onPublish={(name, cover) => togglePublish(name, cover)}
        novelId={novel.id}
        initialName={novel.authorName}
        initialCover={novel.coverImage}
        showToast={showToast}
      />
    </motion.div>
  );
};

const Reader = ({ 
  novel, 
  onBack, 
  onStatUpdate, 
  onOpenProfile, 
  isFollowing, 
  onFollow, 
  onUnfollow, 
  onUpdateProgress,
  onAddToLibrary,
  onRemoveFromLibrary,
  isInLibrary,
  lastReadChapterId,
  currentUser,
  isAdmin,
  onDeleteComment,
  showToast
}: { 
  novel: Novel, 
  onBack: () => void, 
  onStatUpdate: (stat: 'likesCount' | 'viewsCount' | 'sharesCount') => void,
  onOpenProfile: (uid: string) => void,
  isFollowing: boolean,
  onFollow: () => void,
  onUnfollow: () => void,
  onUpdateProgress?: (novelId: string, chapterId: string, chapterOrder: number) => void,
  onAddToLibrary?: () => void,
  onRemoveFromLibrary?: () => void,
  isInLibrary?: boolean,
  lastReadChapterId?: string | null,
  currentUser: User | null,
  isAdmin: boolean,
  onDeleteComment: (novelId: string, chapterId: string, commentId: string) => void,
  showToast: (msg: string, type?: 'success' | 'error') => void
}) => {
  const { t, i18n } = useTranslation();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [hasViewed, setHasViewed] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [fontFamily, setFontFamily] = useState(novel.fontFamily || 'var(--font-serif)');
  const [fontSize, setFontSize] = useState(novel.fontSize || '1.125rem');
  const [textAlign, setTextAlign] = useState(novel.textAlign || 'right');
  const [lineHeight, setLineHeight] = useState(novel.lineHeight || '1.75');
  const [showFormatting, setShowFormatting] = useState(false);
  
  const isAuthor = currentUser?.uid === novel.authorUid;
  const privacyActive = !isAuthor && !isAdmin;

  useEffect(() => {
    if (!privacyActive) return;

    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // Prevent context menu (right click)
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [privacyActive]);

  const handleCopy = () => {
    if (privacyActive) {
      showToast(t('copy_forbidden'), 'error');
      return;
    }
    if (activeChapter?.content) {
      navigator.clipboard.writeText(activeChapter.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySummary = () => {
    if (privacyActive) {
      showToast(t('copy_forbidden'), 'error');
      return;
    }
    if (novel.summary) {
      navigator.clipboard.writeText(novel.summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  useEffect(() => {
    if (!hasViewed) {
      onStatUpdate('viewsCount');
      setHasViewed(true);
    }
  }, [novel.id]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const likeRef = doc(db, `novels/${novel.id}/likes`, auth.currentUser.uid);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
      setHasLiked(doc.exists());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `novels/${novel.id}/likes/${auth.currentUser?.uid}`);
    });
    return () => unsubscribe();
  }, [novel.id]);

  useEffect(() => {
    const q = query(collection(db, `novels/${novel.id}/chapters`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chapter));
      setChapters(docs);
      if (docs.length > 0 && !activeChapter) {
        const lastRead = lastReadChapterId ? docs.find(ch => ch.id === lastReadChapterId) : null;
        handleChapterSelect(lastRead || docs[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `novels/${novel.id}/chapters`);
    });
    return () => unsubscribe();
  }, [novel.id, lastReadChapterId]);

  const handleChapterSelect = (ch: Chapter) => {
    setActiveChapter(ch);
    if (currentUser && onUpdateProgress) {
      onUpdateProgress(novel.id, ch.id, ch.order);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className={`flex flex-col gap-8 relative ${privacyActive ? 'select-none' : ''} privacy-protected`}
    >
      {isBlurred && privacyActive && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-2xl">
          <div className="text-center p-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black/5 text-black/20">
              <Lock size={40} />
            </div>
            <h2 className="mb-2 text-2xl font-bold">{t('content_hidden_privacy')}</h2>
            <p className="text-black/40">{t('return_to_page_warning')}</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100">
          <ArrowLeft size={16} /> {t('back_to_novel')}
        </button>
        <div className="flex items-center gap-4">
          {currentUser && currentUser.uid !== novel.authorUid && (
            <button 
              onClick={() => isFollowing ? onUnfollow() : onFollow()}
              className={`flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all ${isFollowing ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
            >
              {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
              <span>{isFollowing ? t('following') : t('follow_author')}</span>
            </button>
          )}
          {currentUser && (
            <button 
              onClick={() => isInLibrary ? onRemoveFromLibrary?.() : onAddToLibrary?.()}
              className={`flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all ${isInLibrary ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'hover:bg-emerald-50 hover:text-emerald-600'}`}
            >
              <Bookmark size={14} fill={isInLibrary ? "currentColor" : "none"} />
              <span>{isInLibrary ? t('in_library') : t('add_to_library')}</span>
            </button>
          )}
          <button 
            onClick={() => onStatUpdate('likesCount')}
            className={`flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all ${hasLiked ? 'bg-red-50 text-red-600 border-red-200' : 'hover:bg-red-50 hover:text-red-600'}`}
          >
            <Heart size={14} fill={hasLiked ? "currentColor" : "none"} /> {novel.likesCount || 0}
          </button>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              onStatUpdate('sharesCount');
              showToast(t('link_copied'));
            }}
            className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all hover:bg-blue-50 hover:text-blue-600"
          >
            <Share2 size={14} /> {t('share')}
          </button>
          <button 
            onClick={() => setShowFormatting(!showFormatting)}
            className={`flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all ${showFormatting ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
          >
            <Type size={14} /> {t('formatting')}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFormatting && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-4 bg-black/5 p-4 rounded-xl mb-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase opacity-40">{t('font_family')}</span>
                <select 
                  value={fontFamily} 
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="var(--font-serif)">{t('serif')}</option>
                  <option value="var(--font-sans)">{t('sans')}</option>
                  <option value="var(--font-amiri)">{t('amiri')}</option>
                  <option value="var(--font-cairo)">{t('cairo')}</option>
                  <option value="var(--font-tajawal)">{t('tajawal')}</option>
                  <option value="var(--font-lalezar)">{t('lalezar')}</option>
                  <option value="var(--font-merriweather)">{t('merriweather')}</option>
                  <option value="var(--font-roboto)">{t('roboto')}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase opacity-40">{t('font_size')}</span>
                <select 
                  value={fontSize} 
                  onChange={(e) => setFontSize(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="0.875rem">14</option>
                  <option value="1rem">16</option>
                  <option value="1.125rem">18</option>
                  <option value="1.25rem">20</option>
                  <option value="1.5rem">24</option>
                  <option value="1.875rem">30</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase opacity-40">{t('text_align')}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setTextAlign('left')} className={`p-1 rounded ${textAlign === 'left' ? 'bg-black text-white' : 'hover:bg-black/10'}`}><AlignLeft size={14} /></button>
                  <button onClick={() => setTextAlign('center')} className={`p-1 rounded ${textAlign === 'center' ? 'bg-black text-white' : 'hover:bg-black/10'}`}><AlignCenter size={14} /></button>
                  <button onClick={() => setTextAlign('right')} className={`p-1 rounded ${textAlign === 'right' ? 'bg-black text-white' : 'hover:bg-black/10'}`}><AlignRight size={14} /></button>
                  <button onClick={() => setTextAlign('justify')} className={`p-1 rounded ${textAlign === 'justify' ? 'bg-black text-white' : 'hover:bg-black/10'}`}><AlignJustify size={14} /></button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase opacity-40">{t('line_height')}</span>
                <select 
                  value={lineHeight} 
                  onChange={(e) => setLineHeight(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="1.2">1.2</option>
                  <option value="1.5">1.5</option>
                  <option value="1.75">1.75</option>
                  <option value="2">2.0</option>
                  <option value="2.5">2.5</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-12 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-64">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest opacity-40">{t('chapters')}</h3>
          <div className="flex flex-col gap-2">
            {chapters.map(ch => (
              <button 
                key={ch.id}
                onClick={() => handleChapterSelect(ch)}
                className={`text-right px-4 py-2 text-sm transition-all ${activeChapter?.id === ch.id ? 'bg-black text-white' : 'hover:bg-black/5'}`}
              >
                {ch.order}. {ch.title}
              </button>
            ))}
          </div>
        </aside>

        <article className="flex-grow">
          <div className="mb-8 border-b border-black/10 pb-8 text-center">
            <div className="mx-auto mb-6 h-64 w-48 border border-black/10 bg-black/5 flex items-center justify-center overflow-hidden shadow-xl">
              {novel.coverImage ? (
                <img src={novel.coverImage} alt={novel.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Logo size={64} className="opacity-10" />
              )}
            </div>
            <h1 className="mb-2 text-4xl font-serif font-bold tracking-tighter">{novel.title}</h1>
            <div className="flex items-center justify-center gap-2 text-sm mb-6">
              <span className="opacity-50">{t('by')}</span>
              <button 
                onClick={() => onOpenProfile(novel.authorUid)}
                className="font-bold underline underline-offset-4 hover:text-emerald-600"
              >
                {novel.authorName || t('unknown_author')}
              </button>
            </div>

            <div className="mx-auto max-w-2xl bg-black/5 p-6 rounded-xl relative group">
              {!privacyActive && (
                <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={handleCopySummary}
                    className="flex items-center gap-2 rounded-full bg-white border border-black/10 px-3 py-1.5 text-[10px] font-bold shadow-sm hover:bg-black hover:text-white transition-all"
                  >
                    {copiedSummary ? <Check size={12} /> : <Copy size={12} />}
                    {copiedSummary ? t('copied') : t('copy_summary')}
                  </button>
                </div>
              )}
              <p className="text-sm leading-relaxed text-black/60 italic">
                {novel.summary}
              </p>
            </div>
          </div>

          {activeChapter ? (
            <div className="prose prose-lg max-w-none">
              <div className="mb-8 flex items-center justify-between border-b border-black/10 pb-4">
                <h2 className="text-2xl font-serif font-bold">{activeChapter.title}</h2>
                {activeChapter.content && !privacyActive && (
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all hover:bg-black hover:text-white"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? t('copied') : t('copy_chapter')}
                  </button>
                )}
              </div>
              <div 
                className="whitespace-pre-wrap relative"
                style={{ 
                  fontFamily: fontFamily, 
                  fontSize: fontSize, 
                  textAlign: textAlign as any,
                  lineHeight: lineHeight,
                  color: 'rgba(0,0,0,0.8)'
                }}
              >
                {privacyActive && (
                  <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center overflow-hidden opacity-[0.03] select-none" aria-hidden="true">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="m-8 -rotate-45 whitespace-nowrap text-2xl font-bold uppercase tracking-widest">
                        {currentUser?.displayName || currentUser?.email || t('protected')}
                      </div>
                    ))}
                  </div>
                )}
                {activeChapter.content || t('no_content_yet')}
              </div>

              <CommentsSection 
                novelId={novel.id} 
                chapterId={activeChapter.id} 
                currentUser={currentUser} 
                isAdmin={isAdmin}
                onDeleteComment={(commentId) => onDeleteComment(novel.id, activeChapter.id, commentId)}
              />
            </div>
          ) : (
            <div className="py-20 text-center text-black/30">{t('select_chapter_to_read')}</div>
          )}
        </article>
      </div>
    </motion.div>
  );
};

const Editor = ({ novel, chapter, onBack, showToast, setConfirmModal }: { 
  novel: Novel, 
  chapter: Chapter, 
  onBack: () => void, 
  showToast: (msg: string, type?: 'success' | 'error') => void,
  setConfirmModal: (modal: { isOpen: boolean, title: string, message: string, onConfirm: () => void }) => void
}) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState(chapter.content);
  const [description, setDescription] = useState(chapter.description || '');
  const [title, setTitle] = useState(chapter.title);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [suggestingTitle, setSuggestingTitle] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [fontFamily, setFontFamily] = useState(novel.fontFamily || 'var(--font-serif)');
  const [fontSize, setFontSize] = useState(novel.fontSize || '1.125rem');
  const [textAlign, setTextAlign] = useState(novel.textAlign || 'right');
  const [lineHeight, setLineHeight] = useState(novel.lineHeight || '1.75');
  const contentRef = useRef(content);
  const descriptionRef = useRef(description);
  const titleRef = useRef(title);

  useEffect(() => {
    setFontFamily(novel.fontFamily || 'var(--font-serif)');
    setFontSize(novel.fontSize || '1.125rem');
    setTextAlign(novel.textAlign || 'right');
    setLineHeight(novel.lineHeight || '1.75');
  }, [novel.fontFamily, novel.fontSize, novel.textAlign, novel.lineHeight]);

  const updateFormatting = async (field: string, value: string) => {
    // Update local state first for immediate feedback
    if (field === 'fontFamily') setFontFamily(value);
    if (field === 'fontSize') setFontSize(value);
    if (field === 'textAlign') setTextAlign(value as any);
    if (field === 'lineHeight') setLineHeight(value);

    const path = `novels/${novel.id}`;
    try {
      await updateDoc(doc(db, 'novels', novel.id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    contentRef.current = content;
    descriptionRef.current = description;
    titleRef.current = title;
  }, [content, description, title]);

  const save = useCallback(async (contentToSave: string, descriptionToSave: string, titleToSave: string) => {
    if (saving) return;
    setSaving(true);
    const path = `novels/${novel.id}/chapters/${chapter.id}`;
    try {
      await updateDoc(doc(db, `novels/${novel.id}/chapters`, chapter.id), {
        content: contentToSave,
        description: descriptionToSave,
        title: titleToSave,
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'novels', novel.id), {
        updatedAt: serverTimestamp()
      });
      setLastSaved(new Date());
    } catch (e) { 
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
    setSaving(false);
  }, [novel.id, chapter.id, saving]);

  const applyToAllNovels = async () => {
    setConfirmModal({
      isOpen: true,
      title: t('apply_to_all_title', 'تطبيق التنسيقات'),
      message: t('apply_to_all_confirm', 'هل تريد تطبيق هذه التنسيقات على جميع رواياتك؟'),
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        setSaving(true);
        try {
          const q = query(collection(db, 'novels'), where('authorUid', '==', novel.authorUid));
          const snap = await getDocs(q);
          const promises = snap.docs.map(d => updateDoc(d.ref, {
            fontFamily,
            fontSize,
            textAlign,
            lineHeight,
            updatedAt: serverTimestamp()
          }));
          await Promise.all(promises);
          showToast(t('applied_to_all_success', 'تم تطبيق التنسيقات على جميع الروايات بنجاح'), 'success');
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, 'novels');
        }
        setSaving(false);
      }
    });
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (contentRef.current !== chapter.content || descriptionRef.current !== (chapter.description || '') || titleRef.current !== chapter.title) {
        save(contentRef.current, descriptionRef.current, titleRef.current);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [save, chapter.content, chapter.description, chapter.title]);

  const handleAiGenerate = async () => {
    setGenerating(true);
    try {
      let previousPartSummary = '';
      if (novel.previousPartId) {
        const prevDoc = await getDoc(doc(db, 'novels', novel.previousPartId));
        if (prevDoc.exists()) {
          previousPartSummary = prevDoc.data().summary || '';
        }
      }

      const aiContent = await generateChapterContent(
        novel.title, 
        chapter.title, 
        novel.summary, 
        t('chapter_order_prefix') + chapter.order,
        description,
        novel.language || 'ar',
        novel.violenceLevel || 'none',
        novel.moralTone || 'neutral',
        previousPartSummary
      );
      if (aiContent) {
        setContent(prev => prev + (prev ? '\n\n' : '') + aiContent);
      }
    } catch (e) {
      console.error(e);
      showToast(t('error_generating_content'), 'error');
    }
    setGenerating(false);
  };

  const handleGenerateChapterDescription = async () => {
    setGeneratingDescription(true);
    try {
      const suggestedDescription = await generateChapterDescription(
        novel.title,
        novel.summary,
        chapter.title,
        novel.language || 'ar'
      );
      if (suggestedDescription) {
        setDescription(suggestedDescription);
        showToast(t('description_generated_success', 'تم توليد وصف الفصل بنجاح!'), 'success');
      }
    } catch (e) {
      console.error(e);
      showToast(t('error_generating_description', 'حدث خطأ أثناء توليد وصف الفصل.'), 'error');
    }
    setGeneratingDescription(false);
  };

  const handleSuggestTitle = async () => {
    if (!content.trim()) {
      showToast(t('content_required_for_title', 'يرجى كتابة بعض المحتوى أولاً لتوليد عنوان مناسب.'), 'error');
      return;
    }
    setSuggestingTitle(true);
    try {
      const suggestedTitle = await suggestChapterTitle(
        novel.title,
        novel.summary,
        content,
        novel.language || 'ar'
      );
      if (suggestedTitle) {
        setTitle(suggestedTitle);
        showToast(t('title_suggested_success', 'تم اقتراح عنوان جديد بنجاح!'), 'success');
      }
    } catch (e) {
      console.error(e);
      showToast(t('error_suggesting_title', 'حدث خطأ أثناء اقتراح العنوان.'), 'error');
    }
    setSuggestingTitle(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100">
          <ArrowLeft size={16} /> {t('back_to_novel')}
        </button>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-[10px] opacity-30">
              {t('last_saved')} {lastSaved.toLocaleTimeString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
            </span>
          )}
          <button 
            onClick={handleAiGenerate} 
            disabled={generating}
            className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all hover:bg-purple-50 hover:text-purple-600 disabled:opacity-50"
          >
            <Sparkles size={14} /> {generating ? t('writing_ai') : t('write_with_ai')}
          </button>
          <button 
            onClick={handleCopyContent}
            className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all hover:bg-black hover:text-white"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t('copied') : t('copy_text')}
          </button>
          <span className="text-xs text-black/40">{saving ? t('saving') : t('saved')}</span>
          <button onClick={() => save(content, description, title)} className="monochrome-button py-2 text-sm">
            <Save size={16} /> {t('save')}
          </button>
        </div>
      </div>
      <div className="monochrome-card min-h-[600px] p-0 flex flex-col">
        <div className="border-b border-black/10 p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-grow max-w-2xl">
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="text-3xl font-serif font-bold tracking-tighter bg-transparent border-none outline-none w-full focus:ring-0"
                placeholder={t('chapter_title')}
              />
              <button 
                onClick={handleSuggestTitle}
                disabled={suggestingTitle}
                title={t('suggest_title_ai', 'اقتراح عنوان بالذكاء الاصطناعي')}
                className="p-2 rounded-full hover:bg-purple-50 text-purple-600 transition-all disabled:opacity-30"
              >
                {suggestingTitle ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 bg-black/5 p-1 rounded-lg">
              <div className="flex items-center gap-1 border-r border-black/10 pr-2 mr-2">
                <Type size={14} className="opacity-40" />
                <select 
                  value={fontFamily} 
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    updateFormatting('fontFamily', e.target.value);
                  }}
                  className="bg-transparent text-[10px] font-bold uppercase outline-none cursor-pointer"
                >
                  <option value="var(--font-serif)">Serif (Default)</option>
                  <option value="var(--font-sans)">Sans (Inter)</option>
                  <option value="var(--font-amiri)">Amiri (Arabic)</option>
                  <option value="var(--font-cairo)">Cairo</option>
                  <option value="var(--font-tajawal)">Tajawal</option>
                  <option value="var(--font-lalezar)">Lalezar</option>
                  <option value="var(--font-merriweather)">Merriweather</option>
                  <option value="var(--font-roboto)">Roboto</option>
                </select>
              </div>

              <div className="flex items-center gap-1 border-r border-black/10 pr-2 mr-2">
                <span className="text-[10px] font-bold opacity-40">px</span>
                <select 
                  value={fontSize} 
                  onChange={(e) => {
                    setFontSize(e.target.value);
                    updateFormatting('fontSize', e.target.value);
                  }}
                  className="bg-transparent text-[10px] font-bold outline-none cursor-pointer"
                >
                  <option value="0.875rem">14</option>
                  <option value="1rem">16</option>
                  <option value="1.125rem">18</option>
                  <option value="1.25rem">20</option>
                  <option value="1.5rem">24</option>
                  <option value="1.875rem">30</option>
                </select>
              </div>

              <div className="flex items-center gap-1 border-r border-black/10 pr-2 mr-2">
                <button 
                  onClick={() => { setTextAlign('left'); updateFormatting('textAlign', 'left'); }}
                  className={`p-1 rounded ${textAlign === 'left' ? 'bg-black text-white' : 'hover:bg-black/10'}`}
                >
                  <AlignLeft size={14} />
                </button>
                <button 
                  onClick={() => { setTextAlign('center'); updateFormatting('textAlign', 'center'); }}
                  className={`p-1 rounded ${textAlign === 'center' ? 'bg-black text-white' : 'hover:bg-black/10'}`}
                >
                  <AlignCenter size={14} />
                </button>
                <button 
                  onClick={() => { setTextAlign('right'); updateFormatting('textAlign', 'right'); }}
                  className={`p-1 rounded ${textAlign === 'right' ? 'bg-black text-white' : 'hover:bg-black/10'}`}
                >
                  <AlignRight size={14} />
                </button>
                <button 
                  onClick={() => { setTextAlign('justify'); updateFormatting('textAlign', 'justify'); }}
                  className={`p-1 rounded ${textAlign === 'justify' ? 'bg-black text-white' : 'hover:bg-black/10'}`}
                >
                  <AlignJustify size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <Baseline size={14} className="opacity-40" />
                <select 
                  value={lineHeight} 
                  onChange={(e) => {
                    setLineHeight(e.target.value);
                    updateFormatting('lineHeight', e.target.value);
                  }}
                  className="bg-transparent text-[10px] font-bold outline-none cursor-pointer"
                >
                  <option value="1.2">1.2</option>
                  <option value="1.5">1.5</option>
                  <option value="1.75">1.75</option>
                  <option value="2">2.0</option>
                  <option value="2.5">2.5</option>
                </select>
              </div>

              <button 
                onClick={applyToAllNovels}
                className="ml-2 rounded bg-black/10 px-2 py-1 text-[9px] font-bold hover:bg-black hover:text-white transition-colors"
                title={t('apply_to_all')}
              >
                {t('apply_to_all', 'تطبيق على الكل')}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase opacity-40">{t('chapter_description_label', 'وصف الفصل (للمساعدة في الكتابة بالذكاء الاصطناعي)')}</label>
              <button 
                onClick={handleGenerateChapterDescription}
                disabled={generatingDescription}
                className="flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:text-purple-800 disabled:opacity-50"
              >
                {generatingDescription ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {t('ai_suggest_description', 'اقتراح وصف بالذكاء الاصطناعي')}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('chapter_description_placeholder', 'اكتب ملخصاً أو أحداثاً تريد أن يتناولها الفصل...')}
              className="w-full bg-black/5 rounded-lg p-3 text-xs outline-none focus:bg-black/10 transition-colors resize-none h-20"
            />
          </div>
        </div>
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('start_writing_here')}
          style={{ 
            fontFamily: fontFamily, 
            fontSize: fontSize, 
            textAlign: textAlign as any,
            lineHeight: lineHeight
          }}
          className="flex-grow min-h-[500px] w-full resize-none p-8 outline-none"
        />
      </div>
    </motion.div>
  );
};

const SettingsView = ({ profile, onUpdateProfile, showToast }: { profile: UserProfile, onUpdateProfile: (data: any) => Promise<void>, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const { t, i18n } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [autoSync, setAutoSync] = useState(profile.autoSync || false);
  const [avatarDesc, setAvatarDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleGenerateAvatar = async () => {
    if (!displayName && !avatarDesc) {
      showToast(t('enter_name_or_desc_error'), 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await generateAvatar(displayName, bio, avatarDesc);
      if (url) {
        setPhotoURL(url);
      }
    } catch (e: any) {
      console.error("Error generating avatar", e);
      showToast(`${t('error_generating_avatar')} ${e.message || t('unknown_error')}`, 'error');
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateProfile({ 
        displayName, 
        photoURL, 
        bio,
        autoSync
      });
      setSuccess(true);
      showToast(t('settings_saved_success'), 'success');
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      let displayError = t('error_updating_profile');
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.error) displayError += `: ${parsed.error}`;
      } catch {
        displayError += `: ${errorMsg}`;
      }
      showToast(displayError, 'error');
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
      <h2 className="mb-8 text-4xl font-serif font-bold">{t('settings')}</h2>
      
      <div className="monochrome-card mb-8">
        <h3 className="mb-6 font-bold">{t('edit_profile')}</h3>
        
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <div 
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-black/5 bg-black/5"
            >
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-black/20">
                  <UserIcon size={48} />
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="h-6 w-6 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            <div className="flex-grow">
              <p className="text-sm font-bold">{t('avatar_url')}</p>
              <p className="mb-3 text-xs text-black/40">{t('avatar_description')}</p>
              
              <div className="mb-3">
                <input 
                  type="text" 
                  value={avatarDesc}
                  onChange={(e) => setAvatarDesc(e.target.value)}
                  placeholder={t('avatar_description')}
                  className="w-full border-b border-black/10 py-1 text-xs outline-none focus:border-black"
                />
              </div>

              <button 
                onClick={handleGenerateAvatar}
                disabled={uploading}
                className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs font-bold transition-all hover:bg-black hover:text-white disabled:opacity-50"
              >
                <Sparkles size={14} /> {uploading ? t('generating_ai') : t('generate_avatar_ai')}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('display_name')}</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border-b border-black/10 py-2 outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('bio')}</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('bio')}
              className="w-full border-b border-black/10 py-2 outline-none focus:border-black min-h-[100px] resize-none"
            />
          </div>

          <div className="border-t border-black/5 pt-8">
            <h3 className="mb-4 text-sm font-bold">{t('auto_sync')}</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">{t('auto_sync')}</p>
                  <p className="text-[10px] opacity-40">سيتم نشر الرواية في التطبيق الشريك فور نشرها هنا.</p>
                </div>
                <button 
                  onClick={() => setAutoSync(!autoSync)}
                  className={`h-6 w-12 rounded-full transition-all ${autoSync ? 'bg-black' : 'bg-black/10'}`}
                >
                  <div className={`h-4 w-4 rounded-full bg-white transition-all ${autoSync ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {autoSync && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 rounded-xl bg-black/5 p-4"
                >
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-50">API Key (x-api-key)</label>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-black/10 px-2 py-1 text-[10px] font-mono">Alone4Ever</code>
                    </div>
                    <p className="mt-1 text-[9px] opacity-40">استخدم هذا المفتاح في إعدادات التطبيق الشريك للمصادقة.</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="monochrome-button w-full py-3"
          >
            {saving ? t('saving') : success ? t('settings_saved_success') : t('save_settings')}
          </button>
        </div>
      </div>

      <div className="monochrome-card">
        <h3 className="mb-4 font-bold">{t('about_app')}</h3>
        <p className="text-sm text-black/60">{t('app_name')} v1.0.0 - {t('ai_writing_platform')}</p>
      </div>
    </motion.div>
  );
};

const SearchView = ({ query, results, loading, onOpenNovel, onOpenProfile }: { 
  query: string, 
  results: { novels: Novel[], users: UserProfile[] }, 
  loading: boolean,
  onOpenNovel: (n: Novel) => void,
  onOpenProfile: (uid: string) => void
}) => {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-12">
        <h2 className="text-4xl font-serif font-bold tracking-tighter">{t('search_results_for')} {query}</h2>
        <p className="text-black/50">{t('found_novels_and_writers', { novels: results.novels.length, users: results.users.length })}</p>
      </div>

      {loading ? (
        <div className="flex py-20 justify-center"><div className="h-8 w-8 animate-spin border-4 border-black border-t-transparent"></div></div>
      ) : (
        <div className="space-y-12">
          {results.users.length > 0 && (
            <div>
              <h3 className="mb-6 text-xl font-bold">{t('writers')}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.users.map(user => (
                  <button 
                    key={user.uid}
                    onClick={() => onOpenProfile(user.uid)}
                    className="monochrome-card flex items-center gap-4 transition-all hover:border-black"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-black/5">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-black/20">
                          <UserIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{user.displayName}</div>
                      <div className="text-[10px] text-black/40">{t('view_profile')}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.novels.length > 0 && (
            <div>
              <h3 className="mb-6 text-xl font-bold">{t('novels')}</h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.novels.map(novel => (
                  <div key={novel.id} className="monochrome-card group flex flex-col overflow-hidden p-0">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/5">
                      {novel.coverImage ? (
                        <img src={novel.coverImage} alt={novel.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Logo size={64} className="opacity-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h4 className="mb-2 text-xl font-bold leading-tight">{novel.title}</h4>
                      <p className="mb-4 line-clamp-2 text-sm text-black/60">{novel.summary}</p>
                      <button 
                        onClick={() => onOpenNovel(novel)}
                        className="text-sm font-bold underline underline-offset-4"
                      >
                        {t('read_now')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.novels.length === 0 && results.users.length === 0 && (
            <div className="py-20 text-center text-black/30">
              {t('no_results_found')}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const AIBookWriter = ({ onBack, onSave, showToast }: { onBack: () => void, onSave: (title: string, content: string, category: string, description: string, cover: string) => Promise<void>, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('educational');
  const [targetAudience, setTargetAudience] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [isLongForm, setIsLongForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, status: '' });
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [bookHtml, setBookHtml] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [bookCover, setBookCover] = useState('');
  const quillRef = useRef<ReactQuill>(null);

  const turndownService = new TurndownService();

  const handleGenerate = async () => {
    if (!topic.trim()) {
      showToast(t('enter_topic_error', 'يرجى إدخال موضوع الكتاب'), 'error');
      return;
    }
    setGenerating(true);
    setGeneratedContent('');
    setBookHtml('');
    try {
      if (isLongForm) {
        setGenerationProgress({ current: 0, total: 0, status: t('generating_outline', 'جاري إنشاء هيكل الكتاب...') });
        const outline = await generateBookOutline(topic, category, targetAudience, language);
        setGenerationProgress({ current: 0, total: outline.length, status: t('starting_chapters', 'بدء كتابة الفصول...') });
        
        let fullContent = `# ${topic}\n\n`;
        
        for (let i = 0; i < outline.length; i++) {
          const chapter = outline[i];
          setGenerationProgress({ 
            current: i + 1, 
            total: outline.length, 
            status: `${t('writing_chapter', 'جاري كتابة الفصل')} ${i + 1}: ${chapter.title}` 
          });
          
          const chapterContent = await generateChapterContentForBook(topic, chapter.title, chapter.description, outline, language);
          fullContent += `\n\n${chapterContent}\n\n---\n\n`;
          setGeneratedContent(fullContent); // Update UI incrementally
          const html = await marked.parse(fullContent);
          setBookHtml(html);
        }
        
        setBookTitle(topic);
      } else {
        const content = await generateEducationalBook(topic, category, targetAudience, language);
        setGeneratedContent(content);
        const html = await marked.parse(content);
        setBookHtml(html);
        const titleMatch = content.match(/^#\s+(.+)$/m);
        setBookTitle(titleMatch ? titleMatch[1] : topic);
      }

      // Automatically generate cover
      setGeneratingCover(true);
      try {
        const coverUrl = await generateCover(bookTitle || topic, generatedContent.substring(0, 500));
        setBookCover(coverUrl);
      } catch (coverErr) {
        console.error("Error generating cover", coverErr);
      }
      setGeneratingCover(false);

    } catch (e: any) {
      console.error("Error generating book", e);
      const errorMsg = e.message || t('error_generating_book', 'فشل توليد الكتاب');
      showToast(`${t('error_generating_book', 'فشل توليد الكتاب')}: ${errorMsg}`, 'error');
    }
    setGenerating(false);
    setGenerationProgress({ current: 0, total: 0, status: '' });
  };

  const handleGenerateDescription = async () => {
    if (!generatedContent) {
      showToast(t('generate_content_first', 'يرجى توليد محتوى الكتاب أولاً'), 'error');
      return;
    }
    setGeneratingDesc(true);
    try {
      const desc = await generateBookDescription(bookTitle || topic, category, generatedContent, language);
      setBookDescription(desc);
    } catch (e) {
      console.error("Error generating description", e);
      showToast(t('error_generating_description', 'فشل توليد وصف الكتاب'), 'error');
    }
    setGeneratingDesc(false);
  };

  const handleSave = async () => {
    if (!bookHtml) return;
    try {
      // Convert HTML back to markdown for saving
      const markdown = turndownService.turndown(bookHtml);
      await onSave(bookTitle || topic, markdown, category, bookDescription, bookCover);
      showToast(t('book_saved_success', 'تم حفظ الكتاب بنجاح'), 'success');
    } catch (e) {
      console.error("Error saving book", e);
      showToast(t('error_saving_book', 'فشل حفظ الكتاب'), 'error');
    }
  };

  const handleSelectAll = () => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      editor.setSelection(0, editor.getLength());
      showToast(t('all_text_selected', 'تم تحديد النص بالكامل'), 'success');
    }
  };

  const handleDownloadPDF = async () => {
    const editor = quillRef.current?.getEditor();
    const element = editor?.root;
    if (!element) return;
    
    showToast(t('preparing_pdf', 'جاري تحضير ملف PDF...'), 'success');
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${bookTitle || topic}.pdf`);
      showToast(t('pdf_downloaded', 'تم تحميل ملف PDF بنجاح'), 'success');
    } catch (e) {
      console.error("Error generating PDF", e);
      showToast(t('error_generating_pdf', 'فشل توليد ملف PDF'), 'error');
    }
  };

  const handleDownloadWord = () => {
    const editor = quillRef.current?.getEditor();
    const element = editor?.root;
    if (!element) return;

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
          "xmlns:w='urn:schemas-microsoft-com:office:word' " +
          "xmlns='http://www.w3.org/TR/REC-html40'>" +
          "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body style='font-family: Arial, sans-serif; line-height: 1.6;'>";
    const footer = "</body></html>";
    const sourceHTML = header + element.innerHTML + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${bookTitle || topic}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'direction': 'rtl' }],
      [{ 'align': [] }],
      ['clean']
    ],
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100">
          <ArrowLeft size={16} /> {t('back')}
        </button>
        <h2 className="text-3xl font-serif font-bold">{t('ai_book_writer', 'كاتب الكتب بالذكاء الاصطناعي')}</h2>
        <div className="w-16"></div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <div className="monochrome-card">
            <h3 className="mb-4 font-bold text-sm uppercase tracking-widest opacity-50">{t('book_details', 'تفاصيل الكتاب')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold">{t('category', 'التصنيف')}</label>
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  className="monochrome-input text-sm"
                >
                  <option value="educational">{t('cat_educational', 'تعليمي')}</option>
                  <option value="cooking">{t('cat_cooking', 'طبخ')}</option>
                  <option value="scientific">{t('cat_scientific', 'علمي')}</option>
                  <option value="history">{t('cat_history', 'تاريخ')}</option>
                  <option value="self_help">{t('cat_self_help', 'تطوير ذات')}</option>
                  <option value="business">{t('cat_business', 'أعمال')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">{t('topic', 'الموضوع / العنوان')}</label>
                <input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)} 
                  className="monochrome-input text-sm" 
                  placeholder={t('topic_placeholder', 'مثال: أساسيات البرمجة للمبتدئين')} 
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">{t('target_audience', 'الجمهور المستهدف')}</label>
                <input 
                  value={targetAudience} 
                  onChange={e => setTargetAudience(e.target.value)} 
                  className="monochrome-input text-sm" 
                  placeholder={t('audience_placeholder', 'مثال: الأطفال، المحترفين...')} 
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">{t('language', 'اللغة')}</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setLanguage('ar')}
                    className={`flex-grow py-2 text-xs font-bold border ${language === 'ar' ? 'bg-black text-white border-black' : 'border-black/10'}`}
                  >
                    العربية
                  </button>
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`flex-grow py-2 text-xs font-bold border ${language === 'en' ? 'bg-black text-white border-black' : 'border-black/10'}`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-100 rounded">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-purple-600" />
                  <span className="text-xs font-bold text-purple-900">{t('long_form_book', 'كتاب كامل (طويل)')}</span>
                </div>
                <button 
                  onClick={() => setIsLongForm(!isLongForm)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${isLongForm ? 'bg-purple-600' : 'bg-black/10'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isLongForm ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={generating}
                className="monochrome-button w-full mt-4"
              >
                {generating ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                <span>{generating ? t('generating', 'جاري التأليف...') : t('generate_full_book', 'تأليف كتاب كامل')}</span>
              </button>
            </div>
          </div>

          {generating && generationProgress.total > 0 && (
            <div className="monochrome-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase opacity-50">{t('progress', 'التقدم')}</span>
                <span className="text-[10px] font-bold">{Math.round((generationProgress.current / generationProgress.total) * 100)}%</span>
              </div>
              <div className="h-1 w-full bg-black/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 transition-all duration-500" 
                  style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="mt-2 text-[10px] font-medium text-black/60 text-center italic">{generationProgress.status}</p>
            </div>
          )}

          {generatedContent && (
            <div className="monochrome-card">
              <h3 className="mb-4 font-bold text-sm uppercase tracking-widest opacity-50">{t('book_assets', 'ملحقات الكتاب')}</h3>
              <div className="space-y-4">
                <button 
                  onClick={handleGenerateDescription}
                  disabled={generatingDesc}
                  className="monochrome-button-outline w-full text-xs"
                >
                  {generatingDesc ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                  <span>{generatingDesc ? t('generating_desc', 'جاري توليد الوصف...') : t('generate_description', 'توليد وصف الكتاب')}</span>
                </button>

                {bookDescription && (
                  <div className="p-3 bg-black/5 rounded text-[10px] leading-relaxed italic">
                    {bookDescription}
                  </div>
                )}

                <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/5 border border-black/10 rounded">
                  {bookCover ? (
                    <img src={bookCover} alt="Book Cover" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : generatingCover ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RefreshCw size={24} className="animate-spin opacity-20" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <ImageIcon size={40} />
                    </div>
                  )}
                  {generatingCover && <div className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-bold uppercase tracking-tighter">{t('generating_cover', 'جاري رسم الغلاف...')}</div>}
                </div>
              </div>
            </div>
          )}

          {bookHtml && (
            <button 
              onClick={handleSave}
              className="monochrome-button w-full"
            >
              <Save size={18} />
              <span>{t('save_to_library', 'حفظ في المكتبة')}</span>
            </button>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="monochrome-card min-h-[600px] bg-white relative overflow-hidden flex flex-col p-0">
            {!bookHtml && !generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-black/20 p-12 text-center">
                <BookOpen size={80} className="mb-4" />
                <p className="text-lg font-serif italic">{t('start_generating_prompt', 'املأ البيانات على اليمين وابدأ في تأليف كتابك الأول بمساعدة الذكاء الاصطناعي')}</p>
              </div>
            )}

            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                <div className="mb-4 h-12 w-12 animate-spin border-4 border-black border-t-transparent rounded-full"></div>
                <p className="font-bold animate-pulse">{t('ai_is_thinking', 'الذكاء الاصطناعي يجمع المعلومات ويكتب الفصول...')}</p>
              </div>
            )}

            {bookHtml && (
              <div className="flex flex-col h-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between p-2 border-b border-black/10 bg-gray-50 no-print">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-100 hover:bg-red-100 transition-colors"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                    <button 
                      onClick={handleDownloadWord}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      <FileText size={14} />
                      Word
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSelectAll}
                      className="flex items-center gap-1 px-3 py-1.5 bg-black text-white text-[10px] font-bold rounded hover:bg-black/80 transition-colors"
                    >
                      <Copy size={14} />
                      {t('select_all', 'تحديد الكل')}
                    </button>
                    <button 
                      onClick={() => {
                        const editor = quillRef.current?.getEditor();
                        if (editor) {
                          const text = editor.getText();
                          navigator.clipboard.writeText(text);
                          showToast(t('copied_to_clipboard', 'تم النسخ إلى الحافظة'), 'success');
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-black text-[10px] font-bold rounded hover:bg-gray-300 transition-colors"
                    >
                      <Check size={14} />
                      {t('copy', 'نسخ')}
                    </button>
                  </div>
                </div>
                <div className="flex-grow overflow-auto p-4 bg-gray-100">
                  <div className="max-w-4xl mx-auto bg-white shadow-lg min-h-[800px]">
                    <ReactQuill 
                      ref={quillRef}
                      theme="snow"
                      value={bookHtml}
                      onChange={setBookHtml}
                      modules={quillModules}
                      className="h-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CharacterManager = ({ novel, onBack }: { novel: Novel, onBack: () => void }) => {
  const { t } = useTranslation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'protagonist' | 'antagonist' | 'supporting'>('protagonist');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyChar = (char: Character) => {
    const text = `${char.name} (${t(char.role)}): ${char.description}`;
    navigator.clipboard.writeText(text);
    setCopiedId(char.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    const q = query(collection(db, `novels/${novel.id}/characters`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCharacters(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Character)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `novels/${novel.id}/characters`);
    });
    return () => unsubscribe();
  }, [novel.id]);

  const addChar = async () => {
    if (!newName) return;
    const path = `novels/${novel.id}/characters`;
    try {
      await addDoc(collection(db, path), {
        novelId: novel.id,
        name: newName,
        role: newRole,
        traits: '',
        description: '',
        createdAt: serverTimestamp(),
      });
      setNewName('');
      setShowAdd(false);
    } catch (e) { 
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-12 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm opacity-50 hover:opacity-100">
          <ArrowLeft size={16} /> {t('back_to_novel')}
        </button>
        <button onClick={() => setShowAdd(true)} className="monochrome-button py-2 text-sm">
          <Plus size={16} /> {t('add_character')}
        </button>
      </div>

      <h2 className="mb-8 text-4xl font-serif font-bold">{t('characters')}</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {characters.map(char => (
          <div key={char.id} className="monochrome-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t(char.role)}</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleCopyChar(char)}
                  className="text-black/20 hover:text-black"
                  title={t('copy')}
                >
                  {copiedId === char.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
                <button 
                  onClick={async () => {
                    const path = `novels/${novel.id}/characters/${char.id}`;
                    try {
                      await deleteDoc(doc(db, `novels/${novel.id}/characters`, char.id));
                    } catch (e) {
                      handleFirestoreError(e, OperationType.DELETE, path);
                    }
                  }} 
                  className="text-black/20 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold">{char.name}</h3>
            <p className="mt-2 text-sm text-black/60">{char.description || t('no_description_yet')}</p>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white p-8">
            <h3 className="mb-6 text-2xl font-bold">{t('add_new_character')}</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('name')}</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="monochrome-input" placeholder={t('character_name')} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-50">{t('role')}</label>
                <select 
                  value={newRole} 
                  onChange={e => setNewRole(e.target.value as any)}
                  className="monochrome-input"
                >
                  <option value="protagonist">{t('protagonist')}</option>
                  <option value="antagonist">{t('antagonist')}</option>
                  <option value="supporting">{t('supporting')}</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={addChar} className="monochrome-button flex-grow">{t('add')}</button>
                <button onClick={() => setShowAdd(false)} className="monochrome-button-outline flex-grow">{t('cancel')}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
