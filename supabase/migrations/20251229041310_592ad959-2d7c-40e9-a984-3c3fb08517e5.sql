-- Create table for encrypted API keys (admin managed)
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL,
  provider text NOT NULL DEFAULT 'vertex_ai',
  encrypted_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(key_name, provider)
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "Admins can manage all api_keys"
ON public.api_keys
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for AI model configurations
CREATE TABLE public.ai_model_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type text NOT NULL, -- 'text2text' or 'text2speech'
  model_name text NOT NULL,
  model_id text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(model_type, model_id)
);

-- Enable RLS
ALTER TABLE public.ai_model_configs ENABLE ROW LEVEL SECURITY;

-- Admins can manage model configs
CREATE POLICY "Admins can manage ai_model_configs"
ON public.ai_model_configs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view enabled models
CREATE POLICY "Users can view enabled models"
ON public.ai_model_configs
FOR SELECT
USING (is_enabled = true);

-- Insert default Gemini models
INSERT INTO public.ai_model_configs (model_type, model_name, model_id, is_default) VALUES
('text2text', 'Gemini 2.0 Flash', 'gemini-2.0-flash', true),
('text2text', 'Gemini 2.5 Flash', 'gemini-2.5-flash', false),
('text2text', 'Gemini 3.0 Flash', 'gemini-3.0-flash', false),
('text2speech', 'Google Cloud TTS', 'google-cloud-tts', true);

-- Trigger for ai_model_configs updated_at
CREATE TRIGGER update_ai_model_configs_updated_at
BEFORE UPDATE ON public.ai_model_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();