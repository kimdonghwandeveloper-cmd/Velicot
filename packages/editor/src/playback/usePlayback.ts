import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimatableProperty, AnimationData } from '../model/keyframe';
import { interpolateValue } from './interpolate';

type FrameValues = Map<string, Partial<Record<AnimatableProperty, number | string>>>;

interface UsePlaybackReturn {
  currentTime: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  seek: (ms: number) => void;
}

export function usePlayback(
  animation: AnimationData | undefined,
  onTick: (frameValues: FrameValues) => void,
): UsePlaybackReturn {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startWallRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const computeFrame = useCallback(
    (timeMs: number) => {
      if (!animation || animation.tracks.length === 0) return;
      const frameValues: FrameValues = new Map();
      for (const track of animation.tracks) {
        const value = interpolateValue(track, timeMs);
        const entry = frameValues.get(track.targetLayerId) ?? {};
        entry[track.property] = value;
        frameValues.set(track.targetLayerId, entry);
      }
      onTickRef.current(frameValues);
    },
    [animation],
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(
    (wallNow: number) => {
      if (!animation) return;
      const elapsed = wallNow - startWallRef.current;
      const raw = startTimeRef.current + elapsed;
      const shouldLoop = animation.loop !== false;

      if (raw >= animation.duration && shouldLoop) {
        // Restart: reset wall clock reference so elapsed resets from 0.
        startWallRef.current = wallNow;
        startTimeRef.current = 0;
        setCurrentTime(0);
        computeFrame(0);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const t = Math.min(raw, animation.duration);
      setCurrentTime(t);
      computeFrame(t);
      if (t < animation.duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    },
    [animation, computeFrame],
  );

  const play = useCallback(() => {
    if (!animation) return;
    stop();
    startWallRef.current = performance.now();
    startTimeRef.current = currentTime >= (animation.duration ?? 0) ? 0 : currentTime;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [animation, currentTime, stop, tick]);

  const pause = useCallback(() => {
    stop();
    setIsPlaying(false);
  }, [stop]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.min(Math.max(ms, 0), animation?.duration ?? 0);
      setCurrentTime(clamped);
      computeFrame(clamped);
    },
    [animation, computeFrame],
  );

  useEffect(() => () => stop(), [stop]);

  return { currentTime, isPlaying, play, pause, seek };
}
