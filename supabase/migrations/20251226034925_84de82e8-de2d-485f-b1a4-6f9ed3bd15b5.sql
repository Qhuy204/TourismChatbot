-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create dataset_records table to store imported data
CREATE TABLE public.dataset_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.dataset_records ENABLE ROW LEVEL SECURITY;

-- Create annotation_tasks table
CREATE TABLE public.annotation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES auth.users(id),
    percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.annotation_tasks ENABLE ROW LEVEL SECURITY;

-- Create task_records junction table
CREATE TABLE public.task_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.annotation_tasks(id) ON DELETE CASCADE NOT NULL,
    record_id UUID REFERENCES public.dataset_records(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'needs_review', 'rejected')),
    annotated_by UUID REFERENCES auth.users(id),
    annotated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (task_id, record_id)
);

ALTER TABLE public.task_records ENABLE ROW LEVEL SECURITY;

-- RLS for dataset_records
CREATE POLICY "Admins can do everything with records"
ON public.dataset_records
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view assigned records"
ON public.dataset_records
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.task_records tr
        JOIN public.annotation_tasks at ON tr.task_id = at.id
        WHERE tr.record_id = dataset_records.id
        AND at.assigned_to = auth.uid()
    )
);

-- RLS for annotation_tasks
CREATE POLICY "Admins can manage all tasks"
ON public.annotation_tasks
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their assigned tasks"
ON public.annotation_tasks
FOR SELECT
USING (assigned_to = auth.uid());

-- RLS for task_records
CREATE POLICY "Admins can manage all task_records"
ON public.task_records
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their task_records"
ON public.task_records
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.annotation_tasks at
        WHERE at.id = task_records.task_id
        AND at.assigned_to = auth.uid()
    )
);

CREATE POLICY "Users can update their task_records"
ON public.task_records
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.annotation_tasks at
        WHERE at.id = task_records.task_id
        AND at.assigned_to = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_dataset_records_updated_at
BEFORE UPDATE ON public.dataset_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotation_tasks_updated_at
BEFORE UPDATE ON public.annotation_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-assign role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign 'user' role on signup
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();