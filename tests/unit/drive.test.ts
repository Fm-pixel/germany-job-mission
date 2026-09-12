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
