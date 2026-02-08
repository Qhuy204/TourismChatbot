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

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
