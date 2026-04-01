import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Client SDK for Server-side use
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Key for Sync
  const SYNC_KEY = "Alone4Ever";

  // Middleware to check API Key
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== SYNC_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // 1. Endpoint to receive novels from the other app
  app.post("/api/sync/receive", authMiddleware, async (req, res) => {
    const { novel, chapters, authorProfile } = req.body;
    
    if (!novel || !novel.title) {
      return res.status(400).json({ error: "Invalid novel data" });
    }

    try {
      // Check if novel already exists (by title or externalId)
      const q = query(collection(db, "novels"), where("title", "==", novel.title));
      const existing = await getDocs(q);
      
      let novelId;
      const novelData = {
        ...novel,
        authorName: authorProfile?.displayName || novel.authorName,
        authorPhoto: authorProfile?.photoURL || novel.authorPhoto,
        updatedAt: serverTimestamp()
      };

      if (existing.empty) {
        // Create new novel
        const docRef = await addDoc(collection(db, "novels"), {
          ...novelData,
          isPublished: true,
          createdAt: serverTimestamp(),
          syncedFrom: "ExternalApp"
        });
        novelId = docRef.id;
      } else {
        // Update existing
        novelId = existing.docs[0].id;
        await updateDoc(doc(db, "novels", novelId), novelData);
      }

      // Sync chapters if provided
      if (chapters && Array.isArray(chapters)) {
        for (const ch of chapters) {
          const chQ = query(collection(db, `novels/${novelId}/chapters`), where("title", "==", ch.title));
          const existingCh = await getDocs(chQ);
          if (existingCh.empty) {
            await addDoc(collection(db, `novels/${novelId}/chapters`), {
              ...ch,
              createdAt: serverTimestamp()
            });
          }
        }
      }

      res.json({ success: true, novelId });
    } catch (error: any) {
      console.error("Sync Receive Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. Endpoint to publish a novel to the other app (Proxy)
  app.post("/api/sync/publish", async (req, res) => {
    const { novel, chapters, authorProfile } = req.body;
    const externalAppUrl = "https://app-other.run.app";

    try {
      const response = await fetch(`${externalAppUrl}/api/sync/receive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SYNC_KEY
        },
        body: JSON.stringify({ novel, chapters, authorProfile })
      });

      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      console.error("Sync Publish Error:", error);
      res.status(500).json({ error: "Failed to sync with external app: " + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Sync Endpoint: http://localhost:${PORT}/api/sync/receive`);
    console.log(`API Key: ${SYNC_KEY}`);
  });
}

startServer();
