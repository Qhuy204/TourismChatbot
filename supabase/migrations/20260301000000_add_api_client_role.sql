-- Migration: Add api_client role to app_role enum
-- Adds a new role for API key-based access (developer integrations)

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'api_client';
