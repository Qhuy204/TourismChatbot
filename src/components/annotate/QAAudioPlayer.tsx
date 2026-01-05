import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QAAudioPlayerProps {
  src: string | undefined;
  label?: string;
  className?: string;
  compact?: boolean;
}

export interface QAAudioPlayerRef {
  stop: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;

export const QAAudioPlayer = forwardRef<QAAudioPlayerRef, QAAudioPlayerProps>(
  ({ src, label, className, compact = true }, ref) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    // Expose stop method to parent
    useImperativeHandle(ref, () => ({
      stop: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
    }));

    // Reset state when src changes
    useEffect(() => {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsLoaded(false);
    }, [src]);

    // Update playback rate when speed changes
    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.playbackRate = playbackSpeed;
      }
    }, [playbackSpeed]);

    const togglePlay = useCallback(() => {
      if (!audioRef.current || !src) return;
      
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err);
        });
      }
      setIsPlaying(!isPlaying);
    }, [isPlaying, src]);

    const handleTimeUpdate = useCallback(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
        setIsLoaded(true);
        audioRef.current.playbackRate = playbackSpeed;
      }
    }, [playbackSpeed]);

    const handleEnded = useCallback(() => {
      setIsPlaying(false);
      setCurrentTime(0);
    }, []);

    const handleError = useCallback(() => {
      setIsLoaded(false);
      setDuration(0);
    }, []);

    const formatTime = (time: number) => {
      if (isNaN(time) || !isFinite(time)) return '0:00';
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (compact) {
      return (
        <div className={cn("flex items-center gap-1", className)}>
          {src && (
            <audio
              ref={audioRef}
              src={src}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={handleError}
              preload="metadata"
            />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={togglePlay}
            disabled={!src}
            title={src ? `${label || 'Play'} - ${formatTime(duration)}` : 'No audio'}
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          {isLoaded && duration > 0 && (
            <span className="text-[10px] text-muted-foreground min-w-[32px]">
              {isPlaying ? formatTime(currentTime) : formatTime(duration)}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-[10px] px-0">
                {playbackSpeed}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[60px]">
              {PLAYBACK_SPEEDS.map(speed => (
                <DropdownMenuItem 
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={cn("text-xs", playbackSpeed === speed && "bg-accent")}
                >
                  {speed}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-3", className)}>
        {src && (
          <audio
            ref={audioRef}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={handleError}
            preload="metadata"
          />
        )}
        
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shrink-0"
          onClick={togglePlay}
          disabled={!src}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        
        <div className="flex-1 space-y-1">
          {label && (
            <p className="text-sm font-medium truncate">{label}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground min-w-[60px] text-right">
              {formatTime(currentTime)} / {isLoaded && duration > 0 ? formatTime(duration) : '--:--'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  {playbackSpeed}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[60px]">
                {PLAYBACK_SPEEDS.map(speed => (
                  <DropdownMenuItem 
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={cn("text-xs", playbackSpeed === speed && "bg-accent")}
                  >
                    {speed}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  }
);
