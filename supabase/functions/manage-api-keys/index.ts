import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-layer encryption using AES-GCM
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

async function encryptApiKey(apiKey: string, encryptionSecret: string): Promise<string> {
  // Layer 1: Base64 encode
  const base64Key = btoa(apiKey);
  
  // Layer 2: AES-GCM encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(encryptionSecret, salt);
  
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(base64Key)
  );
  
  // Layer 3: Combine salt + iv + encrypted data and encode as base64
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Layer 4: Final base64 encoding with prefix
  return "enc_v1_" + btoa(String.fromCharCode(...combined));
}

async function decryptApiKey(encryptedKey: string, encryptionSecret: string): Promise<string> {
  if (!encryptedKey.startsWith("enc_v1_")) {
    throw new Error("Invalid encrypted key format");
  }
  
  // Remove prefix and decode
  const combined = Uint8Array.from(atob(encryptedKey.slice(7)), c => c.charCodeAt(0));
  
  // Extract salt, iv, and encrypted data
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
  
  // Decode the original base64
  return atob(base64Key);
}

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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, ...params } = await req.json();
    console.log(`Processing action: ${action}`);

    switch (action) {
      case 'list': {
        // List all API keys (without decrypted values)
        const { data: keys, error } = await supabaseClient
          .from('api_keys')
          .select('id, key_name, provider, is_active, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        return new Response(JSON.stringify({ keys }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'add': {
        const { key_name, api_key, provider = 'vertex_ai' } = params;
        
        if (!key_name || !api_key) {
          return new Response(JSON.stringify({ error: 'key_name and api_key are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Encrypt the API key
        const encryptedKey = await encryptApiKey(api_key, encryptionSecret);
        
        const { data, error } = await supabaseClient
          .from('api_keys')
          .insert({
            key_name,
            provider,
            encrypted_key: encryptedKey,
            created_by: user.id
          })
          .select('id, key_name, provider, is_active, created_at')
          .single();

        if (error) {
          if (error.code === '23505') {
            return new Response(JSON.stringify({ error: 'API key with this name already exists' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          throw error;
        }

        console.log(`Added new API key: ${key_name}`);
        return new Response(JSON.stringify({ success: true, key: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        const { id } = params;
        
        if (!id) {
          return new Response(JSON.stringify({ error: 'id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabaseClient
          .from('api_keys')
          .delete()
          .eq('id', id);

        if (error) throw error;

        console.log(`Deleted API key: ${id}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'toggle': {
        const { id, is_active } = params;
        
        if (!id || typeof is_active !== 'boolean') {
          return new Response(JSON.stringify({ error: 'id and is_active are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabaseClient
          .from('api_keys')
          .update({ is_active })
          .eq('id', id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_active': {
        // Get active API key for a provider (used internally for API calls)
        const { provider = 'vertex_ai' } = params;
        
        const { data: key, error } = await supabaseClient
          .from('api_keys')
          .select('encrypted_key')
          .eq('provider', provider)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (error || !key) {
          return new Response(JSON.stringify({ error: 'No active API key found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Decrypt the API key
        const decryptedKey = await decryptApiKey(key.encrypted_key, encryptionSecret);
        
        return new Response(JSON.stringify({ api_key: decryptedKey }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
