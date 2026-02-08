# Tourism Chatbot Assistant 🇻🇳

## 🚀 Latest Updates (Feb 2026)

### ⚡ Performance & Optimization
- **Faster Responses:** Significant reduction in response latency (~15s) by moving heavy AI tasks (deep location extraction, auto-titling) to background processes.
- **Instant Suggestions:** Implemented `Fast Location Extraction` (Regex/Dictionary-based) to provide immediate travel suggestions while the main response is generating.
- **Async Verification:** Backend now asynchronously verifies image URLs status (HEAD request) before sending to client, removing dead links automatically.

### 🧠 Intelligence & Natural Language
- **Style Mimicry:** The AI now analyzes recent user messages to adapt its tone (Casual vs. Professional/Formal).
- **Refined Prompts:** Suggestions are now more natural, concise, and professional, removing overly casual or repetitive filler words.
- **Smart Location Awareness:** Added alias support (e.g., "Sài Gòn" -> "Hồ Chí Minh", "Hà Nội" -> "HN") for better context understanding.

### 🖼️ Robust Image Handling
- **Strict No-Hallucination:** System prompt updated to strictly forbid generating fake image URLs. Images are only shown if they exist in the retrieved context.
- **Smart Rendering:** Frontend automatically detects raw URLs in text (from models like Qwen) and converts them to Markdown Image syntax.
- **Fallback UI:** Broken images are automatically hidden to prevent UI stutter/layout shifts. `loading="lazy"` enabled for better performance.

### 🛠️ Technical Improvements
- **Robust JSON Parsing:** Enhanced `gemini_client` to handle Markdown code blocks and trailing commas in JSON responses.
- **Project Structure:** Optimized `.gitignore` for large model folders (`VQA/`).

---

## 🌟 Project Overview
An intelligent, AI-powered travel assistant designed for Vietnam tourism. The chatbot leverages advanced RAG (Retrieval-Augmented Generation) and Agentic Workflow to provide personalized, actuate, and culturally relevant travel advice.

## ✨ Key Features

### 🤖 Intelligent Conversation
- **Multi-Model Support:** Seamlessly switches between **Gemini 1.5 Flash** (fast response) and **Qwen3-VL** (local visual understanding).
- **Agentic Workflow:** Powered by LangGraph with specialized nodes (Intent Classification, Emotion Analysis, Guardrails, Retrieval, Generation).
- **Context Awareness:** Maintains long-term memory of user preferences, travel style, and conversation history.

### 🔍 Smart Retrieval (RAG)
- **Visual Question Answering (VQA):** Retrieves information not just from text but also understands travel images using Vector Search (ChromaDB).
- **Real-time Suggestions:** Proactively suggests relevant travel topics and questions based on context.
- **Location Extraction:** Automatically detects and normalizes Vietnamese location names (e.g., "Sài Gòn" -> "Hồ Chí Minh") for precise recommendations.

### 🎨 Modern User Experience
- **Adaptive UI:** Light/Dark mode, responsive design, and smooth animations.
- **Rich Media:** Displays travel images directly in chat with smart fallback handling for broken links.
- **Style Mimicry:** The AI adapts its tone (Casual/Formal) to match the user's communication style.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Components:** [shadcn/ui](https://ui.shadcn.com/)
- **State Management:** React Hooks + Context API
- **Markdown:** `react-markdown` with GFM support

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Orchestration:** [LangGraph](https://langchain-ai.github.io/langgraph/) + LangChain
- **AI Models:** 
  - Google Gemini 1.5 Flash/Pro (via API)
  - Qwen3-VL (Fine-tuned, local/server)
- **Vector Database:** [ChromaDB](https://www.trychroma.com/)
- **Authentication:** [Supabase Auth](https://supabase.com/)

### Infrastructure & Tools
- **Version Control:** Git
- **Package Manager:** npm (Frontend), pip (Backend)
- **Environment:** Linux/Conda

## 🚀 Getting Started

### Prerequisites
- Node.js & npm
- Python 3.10+ (Conda recommended)
- Supabase Account & Project
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd TourismChatbot
   ```

2. **Frontend Setup**
   ```bash
   npm install
   npm run dev
   ```

3. **Backend Setup**
   ```bash
   cd Backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
