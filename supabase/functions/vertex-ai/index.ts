import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decryption functions (same as manage-api-keys)
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function decryptApiKey(encryptedKey: string, encryptionSecret: string): Promise<string> {
  if (!encryptedKey.startsWith("enc_v1_")) {
    throw new Error("Invalid encrypted key format");
  }

  const combined = Uint8Array.from(atob(encryptedKey.slice(7)), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);

  const key = await deriveKey(encryptionSecret, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );

  const decoder = new TextDecoder();
  const base64Key = decoder.decode(decrypted);

  return atob(base64Key);
}

// Get active API key from database
async function getActiveApiKey(supabaseClient: any, encryptionSecret: string): Promise<string> {
  // Try 'gemini' provider first (used by frontend), then 'vertex_ai' (legacy)
  const { data: key, error } = await supabaseClient
    .from('api_keys')
    .select('encrypted_key')
    .in('provider', ['gemini', 'vertex_ai'])
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !key) {
    console.error('No API key found:', error);
    throw new Error('No active Gemini API key found. Please add one in Settings.');
  }

  return await decryptApiKey(key.encrypted_key, encryptionSecret);
}

// Vertex AI model mapping
const TEXT_MODELS: Record<string, string> = {
  'gemini-3.0-flash': 'gemini-2.0-flash',
  'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash': 'gemini-2.0-flash',
};

const TTS_MODELS: Record<string, string> = {
  'gemini-2.5-flash-tts': 'gemini-2.5-flash-preview-tts',
  'gemini-2.5-flash-lite-tts': 'gemini-2.5-flash-lite-preview-tts',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionSecret = Deno.env.get('API_KEY_ENCRYPTION_SECRET')!;

    if (!encryptionSecret) {
      throw new Error("Encryption secret not configured");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { action, ...params } = await req.json();
    console.log(`Processing Vertex AI action: ${action}`);

    // Get the active API key
    const apiKey = await getActiveApiKey(supabaseClient, encryptionSecret);

    switch (action) {
      case 'text_generation': {
        const {
          prompt,
          model = 'gemini-2.5-flash',
          temperature = 0.7,
          max_tokens = 1024,
          system_prompt
        } = params;

        if (!prompt) {
          return new Response(JSON.stringify({ error: 'prompt is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const modelId = TEXT_MODELS[model] || model;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const contents = [];
        if (system_prompt) {
          contents.push({
            role: 'user',
            parts: [{ text: `System: ${system_prompt}` }]
          });
          contents.push({
            role: 'model',
            parts: [{ text: 'Understood. I will follow these instructions.' }]
          });
        }
        contents.push({
          role: 'user',
          parts: [{ text: prompt }]
        });

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: max_tokens,
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Vertex AI error:', errorText);
          throw new Error(`Vertex AI API error: ${response.status}`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log(`Text generation completed for model: ${modelId}`);
        return new Response(JSON.stringify({
          text,
          model: modelId,
          usage: result.usageMetadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'text_to_speech': {
        const {
          text,
          model = 'gemini-2.5-flash-tts',
          voice = 'Kore',
          language = 'vi-VN'
        } = params;

        if (!text) {
          return new Response(JSON.stringify({ error: 'text is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const modelId = TTS_MODELS[model] || model;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text }]
            }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice
                  }
                }
              }
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('TTS API error:', errorText);
          throw new Error(`TTS API error: ${response.status}`);
        }

        const result = await response.json();
        const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;

        if (!audioData) {
          throw new Error('No audio data in response');
        }

        console.log(`TTS completed for model: ${modelId}, voice: ${voice}`);
        return new Response(JSON.stringify({
          audio: audioData.data,
          mimeType: audioData.mimeType,
          model: modelId,
          voice
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'chat': {
        const {
          messages,
          model = 'gemini-2.5-flash',
          temperature = 0.7,
          max_tokens = 1024
        } = params;

        if (!messages || !Array.isArray(messages)) {
          return new Response(JSON.stringify({ error: 'messages array is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const modelId = TEXT_MODELS[model] || model;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        // Convert messages to Gemini format
        const contents = messages.map((msg: { role: string; content: string }) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: max_tokens,
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Vertex AI chat error:', errorText);
          throw new Error(`Vertex AI API error: ${response.status}`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log(`Chat completed for model: ${modelId}`);
        return new Response(JSON.stringify({
          text,
          model: modelId,
          usage: result.usageMetadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action. Use: text_generation, text_to_speech, or chat' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    console.error('Vertex AI Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
