import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Upload,
    X,
    FileImage,
    FileVideo,
    FileText,
    File,
    Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface UploadedFile {
    url: string;
    type: 'image' | 'video' | 'document' | 'file';
    name: string;
    size: number;
    mimeType: string;
}

interface FileUploadProps {
    onUpload: (file: UploadedFile) => void;
    onRemove?: () => void;
    maxSizeMB?: number;
    accept?: string[];
    disabled?: boolean;
    className?: string;
}

// File type configurations
const FILE_CONFIGS = {
    image: {
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        maxSizeMB: 10,
        icon: FileImage,
    },
    video: {
        extensions: ['mp4', 'webm', 'mov'],
        mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
        maxSizeMB: 50,
        icon: FileVideo,
    },
    document: {
        extensions: ['pdf', 'txt', 'csv', 'md'],
        mimeTypes: ['application/pdf', 'text/plain', 'text/csv', 'text/markdown'],
        maxSizeMB: 10,
        icon: FileText,
    },
};

function getFileType(file: File): 'image' | 'video' | 'document' | 'file' {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (FILE_CONFIGS.image.extensions.includes(ext)) return 'image';
    if (FILE_CONFIGS.video.extensions.includes(ext)) return 'video';
    if (FILE_CONFIGS.document.extensions.includes(ext)) return 'document';
    return 'file';
}

function getMaxSize(fileType: 'image' | 'video' | 'document' | 'file'): number {
    if (fileType === 'video') return FILE_CONFIGS.video.maxSizeMB;
    return 10; // Default 10MB for other types
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
    onUpload,
    onRemove,
    maxSizeMB,
    accept = ['image/*', 'video/mp4', '.pdf', '.txt', '.csv', '.md'],
    disabled = false,
    className
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<UploadedFile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): string | null => {
        const fileType = getFileType(file);
        const maxSize = maxSizeMB || getMaxSize(fileType);

        // Check size
        if (file.size > maxSize * 1024 * 1024) {
            return `File quá lớn. Tối đa ${maxSize}MB cho ${fileType}`;
        }

        // Check extension
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const allowedExts = [
            ...FILE_CONFIGS.image.extensions,
            ...FILE_CONFIGS.video.extensions,
            ...FILE_CONFIGS.document.extensions,
        ];

        if (!allowedExts.includes(ext)) {
            return `Định dạng không hỗ trợ: .${ext}`;
        }

        return null;
    }, [maxSizeMB]);

    const uploadFile = useCallback(async (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const fileType = getFileType(file);
            const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
            const filePath = `chat-uploads/${fileName}`;

            let finalUrl: string;

            try {
                // Try Supabase Storage first
                const { data, error: uploadError } = await supabase.storage
                    .from('user-uploads')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) {
                    throw uploadError;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('user-uploads')
                    .getPublicUrl(data.path);
                finalUrl = urlData.publicUrl;
            } catch (storageErr) {
                // Fallback: Convert to base64 Data URL for local preview/use
                console.warn('Storage upload failed, using base64 fallback:', storageErr);
                finalUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            const uploadedFile: UploadedFile = {
                url: finalUrl,
                type: fileType,
                name: file.name,
                size: file.size,
                mimeType: file.type,
            };

            setPreview(uploadedFile);
            onUpload(uploadedFile);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Upload thất bại');
        } finally {
            setIsUploading(false);
        }
    }, [validateFile, onUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    }, [disabled, uploadFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
        // Reset input
        if (inputRef.current) inputRef.current.value = '';
    }, [uploadFile]);

    const handleRemove = useCallback(() => {
        setPreview(null);
        setError(null);
        onRemove?.();
    }, [onRemove]);

    const getIcon = (type: UploadedFile['type']) => {
        switch (type) {
            case 'image': return FileImage;
            case 'video': return FileVideo;
            case 'document': return FileText;
            default: return File;
        }
    };

    // Preview mode - show uploaded file
    if (preview) {
        const IconComponent = getIcon(preview.type);
        return (
            <div className={cn(
                "relative p-3 border rounded-lg bg-muted/50",
                className
            )}>
                <div className="flex items-center gap-3">
                    {preview.type === 'image' ? (
                        <img
                            src={preview.url}
                            alt={preview.name}
                            className="w-12 h-12 object-cover rounded"
                        />
                    ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                            <IconComponent className="w-6 h-6 text-muted-foreground" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{preview.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatFileSize(preview.size)}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleRemove}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // Upload mode
    return (
        <div className={cn("relative", className)}>
            <input
                ref={inputRef}
                type="file"
                accept={accept.join(',')}
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || isUploading}
            />

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                    isDragging && "border-primary bg-primary/5",
                    !isDragging && "border-muted-foreground/25 hover:border-primary/50",
                    disabled && "opacity-50 cursor-not-allowed",
                    isUploading && "pointer-events-none"
                )}
            >
                {isUploading ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Đang tải lên...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            Kéo thả hoặc nhấn để chọn file
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                            Hỗ trợ: ảnh, video, PDF, TXT, CSV, MD
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}

// Compact inline upload button for chat input - Modern Gemini/ChatGPT style
export function InlineFileUpload({
    onUpload,
    disabled = false
}: {
    onUpload: (file: UploadedFile) => void;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        setIsUploading(true);

        try {
            const fileType = getFileType(file);
            let finalUrl: string;

            try {
                // Try Supabase Storage first
                const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
                const filePath = `chat-uploads/${fileName}`;

                const { data, error } = await supabase.storage
                    .from('user-uploads')
                    .upload(filePath, file, { cacheControl: '3600', upsert: false });

                if (error) throw error;

                const { data: urlData } = supabase.storage
                    .from('user-uploads')
                    .getPublicUrl(data.path);
                finalUrl = urlData.publicUrl;
            } catch {
                // Fallback: Convert to base64
                console.warn('Storage failed, using base64 fallback');
                finalUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            onUpload({
                url: finalUrl,
                type: fileType,
                name: file.name,
                size: file.size,
                mimeType: file.type,
            });
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setIsUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="file"
                accept="image/*,video/mp4,.pdf,.txt,.csv,.md"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || isUploading}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || isUploading}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={cn(
                    "relative flex items-center justify-center",
                    "h-10 w-10 rounded-full",
                    "bg-transparent hover:bg-muted/80",
                    "border border-transparent hover:border-border/50",
                    "transition-all duration-200 ease-out",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isUploading && "animate-pulse"
                )}
            >
                {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                )}
            </button>
            {/* Tooltip */}
            {showTooltip && !isUploading && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md whitespace-nowrap shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    Đính kèm file
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    );
}
