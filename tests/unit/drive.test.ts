import { describe, expect, it, vi } from 'vitest';
import type { drive_v3 } from 'googleapis';
import { ensureFolder, uploadFile } from '@/services/documents/drive';

/**
 * Documents go into the owner's private Drive folder. That code cannot run
 * without a Drive account, so this fake checks the request it would send —
 * especially the query, where an unescaped name would break the lookup and
 * create duplicate folders for the same person.
 */
function fakeDrive(existing: { id: string; name: string }[] = []) {
  const list = vi.fn(async ({ q }: { q: string }) => {
    const name = /name='((?:\\'|[^'])*)'/.exec(q)?.[1]?.replace(/\\'/g, "'");
    const found = existing.find((file) => file.name === name);
    return { data: { files: found ? [found] : [] } };
  });
  const create = vi.fn(async (_args?: unknown) => ({ data: { id: 'new-folder-id' } }));
  return {
    drive: { files: { list, create } } as unknown as drive_v3.Drive,
    list,
    create,
  };
}

describe('finding or creating a person’s folder', () => {
  it('reuses the folder when it is already there', async () => {
    const { drive, create } = fakeDrive([{ id: 'existing-id', name: 'Jean (c1)' }]);
    const id = await ensureFolder('Jean (c1)', 'root', drive);
    expect(id).toBe('existing-id');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates it inside the right parent when it is missing', async () => {
    const { drive, create } = fakeDrive();
    const id = await ensureFolder('Aline (c2)', 'root-folder', drive);
    expect(id).toBe('new-folder-id');
    const body = create.mock.calls[0][0] as { requestBody: { name: string; parents: string[]; mimeType: string } };
    expect(body.requestBody).toMatchObject({
      name: 'Aline (c2)',
      parents: ['root-folder'],
      mimeType: 'application/vnd.google-apps.folder',
    });
  });

  it('escapes a quote in a name, so "O’Brien" finds its own folder instead of making a new one each time', async () => {
    const { drive, list, create } = fakeDrive([{ id: 'obrien-id', name: "O'Brien (c3)" }]);
    const id = await ensureFolder("O'Brien (c3)", 'root', drive);
    const query = (list.mock.calls[0][0] as unknown as { q: string }).q;
    expect(query).toContain("\\'");
    expect(id).toBe('obrien-id');
    expect(create).not.toHaveBeenCalled();
  });

  it('only ever looks for folders that are not in the bin', async () => {
    const { drive, list } = fakeDrive();
    await ensureFolder('X', 'root', drive);
    const query = (list.mock.calls[0][0] as unknown as { q: string }).q;
    expect(query).toContain('trashed=false');
    expect(query).toContain("mimeType='application/vnd.google-apps.folder'");
    expect(query).toContain("'root' in parents");
  });

  it('fails loudly if Drive returns no id rather than storing a broken record', async () => {
    const drive = {
      files: {
        list: async () => ({ data: { files: [] } }),
        create: async () => ({ data: {} }),
      },
    } as unknown as drive_v3.Drive;
    await expect(ensureFolder('X', 'root', drive)).rejects.toThrow(/Could not create the Drive folder/);
  });
});

describe('uploading a document', () => {
  it('sends the file into the given folder with its own name and type', async () => {
    const create = vi.fn(async (_args?: unknown) => ({ data: { id: 'file-123' } }));
    const drive = { files: { create } } as unknown as drive_v3.Drive;
    const result = await uploadFile(
      {
        folderId: 'cv-folder',
        filename: 'Lebenslauf.pdf',
        mimeType: 'application/pdf',
        body: Buffer.from('%PDF-1.4'),
      },
      drive,
    );
    expect(result.fileId).toBe('file-123');
    const args = create.mock.calls[0][0] as {
      requestBody: { name: string; parents: string[] };
      media: { mimeType: string };
    };
    expect(args.requestBody).toMatchObject({ name: 'Lebenslauf.pdf', parents: ['cv-folder'] });
    expect(args.media.mimeType).toBe('application/pdf');
  });

  it('fails loudly when Drive returns no file id', async () => {
    const drive = { files: { create: async () => ({ data: {} }) } } as unknown as drive_v3.Drive;
    await expect(
      uploadFile({ folderId: 'f', filename: 'a.pdf', mimeType: 'application/pdf', body: Buffer.from('x') }, drive),
    ).rejects.toThrow(/did not return a file ID/);
  });
});

describe('who can see the documents folder', () => {
  it('calls out "anyone with the link" — the setting that would expose passports', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing([
      { type: 'user', role: 'owner', emailAddress: 'me@example.com' },
      { type: 'anyone', role: 'reader' },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe('danger');
    expect(warnings[0].text).toMatch(/anyone with the link/i);
  });

  it('calls out a whole-organisation share', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing([{ type: 'domain', role: 'reader' }]);
    expect(warnings[0].level).toBe('danger');
  });

  it('is quiet about the normal setup: me plus the service account', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings, sharedWith } = describeSharing([
      { type: 'user', role: 'owner', emailAddress: 'me@example.com' },
      {
        type: 'user',
        role: 'writer',
        emailAddress: 'firebase-adminsdk-x@certifypm-pro.iam.gserviceaccount.com',
      },
    ]);
    expect(warnings).toEqual([]);
    expect(sharedWith).toHaveLength(2);
  });

  it('mentions it when a crowd can read the candidates’ documents', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing([
      { type: 'user', role: 'owner', emailAddress: 'me@example.com' },
      { type: 'user', role: 'writer', emailAddress: 'a@example.com' },
      { type: 'user', role: 'reader', emailAddress: 'b@example.com' },
      { type: 'user', role: 'reader', emailAddress: 'c@example.com' },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe('warning');
    expect(warnings[0].text).toMatch(/4 people/);
  });
});

describe('is the folder actually shared with the app?', () => {
  const SERVICE_ACCOUNT = 'firebase-adminsdk-fbsvc@certifypm-pro.iam.gserviceaccount.com';

  it('says exactly what to do when the folder is not shared with it', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing(
      [{ type: 'user', role: 'owner', emailAddress: 'me@example.com' }],
      SERVICE_ACCOUNT,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe('danger');
    expect(warnings[0].text).toContain(SERVICE_ACCOUNT);
    expect(warnings[0].text).toMatch(/Share/);
  });

  it('is quiet when it is shared as Editor', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing(
      [
        { type: 'user', role: 'owner', emailAddress: 'me@example.com' },
        { type: 'user', role: 'writer', emailAddress: SERVICE_ACCOUNT },
      ],
      SERVICE_ACCOUNT,
    );
    expect(warnings).toEqual([]);
  });

  it('is not fooled by read-only access, which cannot upload', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing(
      [{ type: 'user', role: 'reader', emailAddress: SERVICE_ACCOUNT }],
      SERVICE_ACCOUNT,
    );
    expect(warnings[0].text).toContain('not shared');
  });

  it('ignores letter case in the address', async () => {
    const { describeSharing } = await import('@/services/documents/drive');
    const { warnings } = describeSharing(
      [{ type: 'user', role: 'writer', emailAddress: SERVICE_ACCOUNT.toUpperCase() }],
      SERVICE_ACCOUNT,
    );
    expect(warnings).toEqual([]);
  });
});
