import { useEffect, useMemo, useRef, useState } from 'react';
import { isTerminalJob, type Job, type JobKind } from '@/entities/job/types';
import { listJobs, subscribeJobEvents } from './jobClient';

export function useJobs(kind?: JobKind | readonly JobKind[]): Job[] {
  const [jobs, setJobs] = useState<Job[]>([]);
  const kindsKey = typeof kind === 'string' ? kind : kind?.join(',');
  const kindSet = useMemo(
    () => (kindsKey === undefined ? null : new Set(kindsKey.split(',') as JobKind[])),
    [kindsKey],
  );

  useEffect(() => {
    let alive = true;
    void listJobs().then((list) => {
      if (!alive) return;
      setJobs(kindSet === null ? list : list.filter((j) => kindSet.has(j.kind)));
    });
    const unsub = subscribeJobEvents(({ job, removedId }) => {
      setJobs((prev) => {
        if (removedId !== undefined) return prev.filter((j) => j.id !== removedId);
        if (!job) return prev;
        if (kindSet !== null && !kindSet.has(job.kind)) return prev.filter((j) => j.id !== job.id);
        const index = prev.findIndex((j) => j.id === job.id);
        if (index === -1) return [job, ...prev];
        const next = [...prev];
        next[index] = job;
        return next;
      });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [kindSet]);

  return jobs;
}

/** Fires when a job newly reaches a terminal state — panels use it for
 *  refresh/announce side effects without owning the row's lifecycle. */
export function useJobTerminalWatcher(
  jobs: readonly Job[],
  onTerminal: (job: Job) => void,
): void {
  const seenRef = useRef<Map<string, Job['status']>>(new Map());
  const handlerRef = useRef(onTerminal);
  handlerRef.current = onTerminal;

  useEffect(() => {
    const seen = seenRef.current;
    for (const job of jobs) {
      const prev = seen.get(job.id);
      seen.set(job.id, job.status);
      if (prev !== undefined && prev !== job.status && isTerminalJob(job) && !isTerminalStatus(prev)) {
        handlerRef.current(job);
      }
    }
    for (const id of [...seen.keys()]) {
      if (!jobs.some((j) => j.id === id)) seen.delete(id);
    }
  }, [jobs]);
}

function isTerminalStatus(status: Job['status']): boolean {
  return status === 'done' || status === 'failed' || status === 'interrupted';
}
