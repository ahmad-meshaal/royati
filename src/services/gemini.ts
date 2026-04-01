import { GoogleGenAI, Type } from "@google/genai";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isTransientError = 
      error.message?.includes('500') || 
      error.message?.includes('xhr error') || 
      error.message?.includes('Rpc failed') ||
      error.message?.includes('quota') ||
      error.message?.includes('429');

    if (retries > 0 && isTransientError) {
      console.warn(`AI request failed, retrying in ${delay}ms... (${retries} retries left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const getAI = () => {
  // Try multiple sources for the API key
  const key = 
    (typeof process !== 'undefined' && process.env?.API_KEY) || 
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
    ((import.meta as any).env?.VITE_API_KEY) ||
    ((import.meta as any).env?.VITE_GEMINI_API_KEY);

  if (!key) {
    throw new Error("Service configuration missing.");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const generatePlot = async (
  title: string, 
  genre: string, 
  summary: string, 
  language: string = 'ar', 
  violenceLevel: string = 'none', 
  moralTone: string = 'neutral',
  previousPartSummary?: string
) => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional author assistant. Help me develop a plot for my novel titled "${title}" in the genre "${genre}". 
      Current Summary: ${summary}
      ${previousPartSummary ? `This is a sequel (Part 2). Summary of the previous part: ${previousPartSummary}` : ''}
      
      Content Guidelines:
      - Violence Level: ${violenceLevel}
      - Moral Tone: ${moralTone}
      
      Please provide:
      1. Detailed plot structure (Beginning, Middle, End).
      2. Suggestions for three main characters (considering returning characters if it's a sequel).
      3. Ideas for the first five chapters.
      
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}, using beautiful Markdown formatting.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("generatePlot error:", error);
    throw error;
  }
};

export const suggestCharacter = async (novelContext: string, characterRole: string, language: string = 'ar') => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on the following novel context: "${novelContext}"
      Suggest a character playing the role of "${characterRole}".
      Provide Name, Traits, and Motivations.
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("suggestCharacter error:", error);
    throw error;
  }
};

export const generateChapterContent = async (
  novelTitle: string, 
  chapterTitle: string, 
  context: string, 
  previousChaptersSummary: string,
  chapterDescription?: string,
  language: string = 'ar',
  violenceLevel: string = 'none',
  moralTone: string = 'neutral',
  previousPartSummary?: string
) => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a creative novelist. Write the content of a chapter for a novel titled "${novelTitle}".
      Chapter Title: "${chapterTitle}"
      ${chapterDescription ? `Chapter Description/Outline: "${chapterDescription}"` : ''}
      Novel Context: "${context}"
      Summary of previous chapters: "${previousChaptersSummary}"
      ${previousPartSummary ? `This is a sequel (Part 2). Summary of the previous part: ${previousPartSummary}` : ''}
      
      Content Guidelines:
      - Violence Level: ${violenceLevel}
      - Moral Tone: ${moralTone}
      
      Write the chapter in a high literary style, engaging, and in ${isEnglish ? 'English' : 'Arabic'}. Focus on dialogue, description, and emotions. Aim for a length of approximately 3000 words.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("generateChapterContent error:", error);
    throw error;
  }
};

export const generateShortSummary = async (title: string, genre: string, fullSummary: string, language: string = 'ar') => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional book marketer. Write a short, catchy, and intriguing description for a novel titled "${title}" in the genre "${genre}".
      Full Summary: "${fullSummary}"
      
      The description should be concise (around 2-3 sentences) and designed to hook potential readers.
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("generateShortSummary error:", error);
    throw error;
  }
};

export const generateCover = async (title: string, summary: string, violenceLevel: string = 'none', moralTone: string = 'neutral') => {
  try {
    const ai = getAI();
    // Step 1: Generate a descriptive prompt for the image
    const promptResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `أنت مصمم أغلفة كتب محترف. بناءً على عنوان الرواية "${title}" وملخصها "${summary}"، 
      ومستوى العنف "${violenceLevel}" والتوجه الأخلاقي "${moralTone}"، 
      اكتب وصفاً دقيقاً ومفصلاً باللغة الإنجليزية ليتم استخدامه كمطالبة (Prompt) لتوليد صورة غلاف فني للرواية. 
      يجب أن يكون الوصف فنياً، يركز على الألوان، الإضاءة، والرموز المعبرة عن القصة. 
      إذا كان مستوى العنف عالياً (high)، يمكن أن يتضمن الوصف عناصر دموية أو قتالية بشكل فني ودرامي.
      اجعل الوصف باللغة الإنجليزية فقط وبدون أي مقدمات.`,
    })).catch(err => {
      console.error("Error generating cover prompt:", err);
      throw new Error(`فشل توليد وصف الغلاف: ${err.message || 'خطأ غير معروف'}`);
    });
    
    const imagePrompt = promptResponse.text;

    // Step 2: Generate the image
    const imageResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A professional book cover art for a novel titled "${title}". The title "${title}" must be written clearly in beautiful Arabic calligraphy at the top or center. High resolution, professional design, cinematic lighting, ${imagePrompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
        },
      },
    })).catch(err => {
      console.error("Error generating cover image:", err);
      throw new Error(`فشل توليد صورة الغلاف: ${err.message || 'خطأ غير معروف'}`);
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error('No image data returned from AI');
  } catch (error: any) {
    console.error("generateCover error:", error);
    throw error;
  }
};

export const generateChapterDescription = async (novelTitle: string, novelSummary: string, chapterTitle: string, language: string = 'ar') => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a creative writing assistant. Based on the novel titled "${novelTitle}" and its summary: "${novelSummary}", 
      suggest a detailed outline or description for a chapter titled "${chapterTitle}".
      The description should include key events, character interactions, and the emotional tone of the chapter.
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("generateChapterDescription error:", error);
    throw error;
  }
};

export const suggestChapterTitle = async (novelTitle: string, novelSummary: string, chapterContent: string, language: string = 'ar') => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a creative novelist. Based on the novel titled "${novelTitle}" and its summary: "${novelSummary}", 
      suggest a short, catchy, and meaningful title for a chapter with the following content:
      "${chapterContent.substring(0, 2000)}"
      
      Provide only the suggested title without any introduction or explanation.
      The title should be in ${isEnglish ? 'English' : 'Arabic'}.`,
    }));
    return response.text.trim();
  } catch (error: any) {
    console.error("suggestChapterTitle error:", error);
    throw error;
  }
};

export const generateAvatar = async (name: string, bio: string, customDescription?: string) => {
  try {
    const ai = getAI();
    // Step 1: Generate a descriptive prompt for the avatar
    const promptResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: customDescription 
        ? `أنت مصمم شخصيات محترف. بناءً على هذا الوصف المخصص من المستخدم: "${customDescription}"، اكتب وصفاً دقيقاً ومفصلاً باللغة الإنجليزية ليتم استخدامه كمطالبة (Prompt) لتوليد صورة ملف شخصي (Avatar) فنية وراقية. 
           يجب أن يحترم الوصف رغبة المستخدم في "${customDescription}".
           اجعل الوصف باللغة الإنجليزية فقط وبدون أي مقدمات.`
        : `أنت مصمم شخصيات محترف. بناءً على اسم المستخدم "${name}" ونبذته التعريفية "${bio}"، اكتب وصفاً دقيقاً ومفصلاً باللغة الإنجليزية ليتم استخدامه كمطالبة (Prompt) لتوليد صورة ملف شخصي (Avatar) فنية وراقية. 
           يجب أن يكون الوصف فنياً، يركز على ملامح الوجه التعبيرية، الإضاءة، والنمط البصري (مثلاً: أبيض وأسود، رسم زيتي، تصوير سينمائي). 
           اجعل الوصف باللغة الإنجليزية فقط وبدون أي مقدمات.`,
    })).catch(err => {
      console.error("Error generating avatar prompt:", err);
      throw new Error(`فشل توليد وصف الصورة الشخصية: ${err.message || 'خطأ غير معروف'}`);
    });
    
    const imagePrompt = promptResponse.text;

    // Step 2: Generate the image
    const imageResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A professional artistic profile picture avatar. High resolution, professional design, cinematic lighting, artistic style, ${imagePrompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    })).catch(err => {
      console.error("Error generating avatar image:", err);
      throw new Error(`فشل توليد الصورة الشخصية: ${err.message || 'خطأ غير معروف'}`);
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error('No image data returned from AI');
  } catch (error: any) {
    console.error("generateAvatar error:", error);
    throw error;
  }
};

export const generateEducationalBook = async (
  topic: string, 
  category: string, 
  targetAudience: string, 
  language: string = 'ar'
) => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert author in the field of "${category}". Write a comprehensive and educational book about "${topic}".
      Target Audience: "${targetAudience}"
      
      The book should include:
      1. A catchy title.
      2. An introduction explaining the importance of the topic.
      3. At least 5 detailed chapters with subheadings.
      4. Practical tips or recipes (if it's a cooking book).
      5. A conclusion summarizing the key takeaways.
      
      Important: Include a "Table of Contents" (Index) at the beginning after the title.
      
      Use a professional and engaging tone. 
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}, using beautiful Markdown formatting.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("generateEducationalBook error:", error);
    throw error;
  }
};

export const generateBookOutline = async (
  topic: string,
  category: string,
  targetAudience: string,
  language: string = 'ar'
) => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional book architect. Create a detailed outline for a comprehensive book about "${topic}" in the category "${category}".
      Target Audience: "${targetAudience}"
      
      The outline should include:
      1. A catchy title.
      2. An introduction.
      3. At least 8-12 detailed chapters, each with 2-3 sub-sections.
      4. A conclusion.
      
      Return the outline as a JSON array of objects, where each object has a "title" and a "description" of what that chapter should cover.
      Example format: [{"title": "Chapter 1: ...", "description": "..."}, ...]
      
      Provide the titles and descriptions in ${isEnglish ? 'English' : 'Arabic'}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "description"]
          }
        }
      }
    }));
    
    let text = response.text.trim();
    
    // Extract JSON from potential markdown blocks or extra text
    const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s) || text.match(/\{.*\}/s);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Response text:", text);
      // Fallback: try to fix common trailing comma or truncation issues
      try {
        // Simple fix for trailing commas before closing brackets
        let fixedText = text.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(fixedText);
      } catch (e) {
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }
  } catch (error: any) {
    console.error("generateBookOutline error:", error);
    throw error;
  }
};

export const generateChapterContentForBook = async (
  bookTopic: string,
  chapterTitle: string,
  chapterDescription: string,
  outline: any[],
  language: string = 'ar'
) => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are writing a long-form book about "${bookTopic}". 
      Write the full content for the chapter: "${chapterTitle}".
      Chapter Context/Description: "${chapterDescription}"
      Full Book Outline for context: ${JSON.stringify(outline)}
      
      Requirements:
      - Write a comprehensive and detailed chapter (around 1000-1500 words).
      - Use detailed subheadings.
      - Include examples, case studies, or practical steps where relevant.
      - Maintain a professional and engaging tone.
      - Use beautiful Markdown formatting.
      
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}.`,
    }));
    return response.text;
  } catch (error: any) {
    console.error("generateChapterContentForBook error:", error);
    throw error;
  }
};

export const generateBookDescription = async (
  topic: string,
  category: string,
  content: string,
  language: string = 'ar'
) => {
  try {
    const ai = getAI();
    const isEnglish = language === 'en';
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional book marketer. Write a short, catchy, and intriguing description for a book titled "${topic}" in the category "${category}".
      Book Content Snippet: "${content.substring(0, 2000)}"
      
      The description should be concise (around 3-4 sentences) and designed to hook potential readers.
      Provide the response in ${isEnglish ? 'English' : 'Arabic'}.`,
    }));
    return response.text.trim();
  } catch (error: any) {
    console.error("generateBookDescription error:", error);
    throw error;
  }
};
