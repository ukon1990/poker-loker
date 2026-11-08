import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type ChangeEvent, useState } from 'react';
import { exportBackup, importBackup } from '@/db/backup';
import { db } from '@/db/client';
import { settingsQuery } from '@/db/queries';
import { updateSettings } from '@/db/repositories';
import type { Settings } from '@/db/schema';
import { button } from '@/ui/button';

const fieldClass =
  'min-h-12 w-full rounded-[10px] border border-line bg-surface px-3 text-base text-ink';
const labelClass = 'flex flex-col gap-1 text-[13px] font-semibold text-ink-2';

function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (patch: Pick<Settings, 'dailyGoalXp' | 'theme' | 'coachEnabled'>) =>
      updateSettings(db, patch),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const form = useForm({
    defaultValues: {
      dailyGoalXp: settings.dailyGoalXp,
      theme: settings.theme,
      coachEnabled: settings.coachEnabled,
    },
    onSubmit: ({ value }) => save.mutateAsync(value),
  });

  async function handleExport() {
    const backup = await exportBackup(db);
    downloadJson(`poker-loker-backup-${backup.exportedAt.slice(0, 10)}.json`, backup);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(db, JSON.parse(await file.text()));
      await queryClient.invalidateQueries();
      setBackupMessage('Backup restored.');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Could not read that file.');
    }
  }

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-5 p-5 lg:p-8">
      <h1 className="m-0 text-[28px] leading-tight font-extrabold">Settings</h1>

      <form
        className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="dailyGoalXp">
          {(field) => (
            <label className={labelClass}>
              Daily goal (XP)
              <input
                className={fieldClass}
                type="number"
                min={1}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.valueAsNumber)}
              />
            </label>
          )}
        </form.Field>

        <form.Field name="theme">
          {(field) => (
            <label className={labelClass}>
              Appearance
              <select
                className={fieldClass}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value as Settings['theme'])}
              >
                <option value="system">Match this device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          )}
        </form.Field>

        <form.Field name="coachEnabled">
          {(field) => (
            <label className="flex min-h-11 items-center gap-3 text-base font-semibold text-ink">
              <input
                type="checkbox"
                className="size-5 accent-[var(--ink)]"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
              />
              Coach at the table
            </label>
          )}
        </form.Field>

        <button type="submit" className={button()}>
          Save
        </button>
        {save.isSuccess && (
          <span role="status" className="text-sm font-semibold text-green">
            Saved.
          </span>
        )}
      </form>

      <section className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
        <h2 className="m-0 text-xl font-bold">Backup</h2>
        <p className="m-0 text-[15px] text-ink-2">
          Your progress is only stored on this device. Export a copy to keep it safe.
        </p>
        <button type="button" className={button('outline')} onClick={() => void handleExport()}>
          Export progress
        </button>
        <label className={labelClass}>
          Import progress
          <input
            type="file"
            accept="application/json"
            onChange={(event) => void handleImport(event)}
          />
        </label>
        {backupMessage && (
          <p role="status" className="m-0 text-sm font-semibold">
            {backupMessage}
          </p>
        )}
      </section>
    </main>
  );
}
