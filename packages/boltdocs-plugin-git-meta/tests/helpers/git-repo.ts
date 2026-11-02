import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export interface FixtureCommit {
  author: string
  email: string
  date: string
  message?: string
  files: Record<string, string>
}

export interface FixtureRepo {
  root: string
  docsDir: string
}

function runGit(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    env: { ...process.env, ...env },
  })
}

export async function createGitRepo(
  commits: FixtureCommit[],
): Promise<FixtureRepo> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'boltdocs-git-meta-'))
  runGit(root, ['init', '-q'])
  runGit(root, ['config', 'commit.gpgsign', 'false'])
  runGit(root, ['config', 'tag.gpgsign', 'false'])
  runGit(root, ['config', 'user.name', 'Fixture'])
  runGit(root, ['config', 'user.email', 'fixture@example.com'])

  for (const commit of commits) {
    for (const [file, content] of Object.entries(commit.files)) {
      const absolute = path.join(root, file)
      await fs.mkdir(path.dirname(absolute), { recursive: true })
      await fs.writeFile(absolute, content)
    }
    runGit(root, ['add', '-A'])
    runGit(root, ['commit', '-q', '-m', commit.message ?? 'commit'], {
      GIT_AUTHOR_NAME: commit.author,
      GIT_AUTHOR_EMAIL: commit.email,
      GIT_AUTHOR_DATE: commit.date,
      GIT_COMMITTER_NAME: commit.author,
      GIT_COMMITTER_EMAIL: commit.email,
      GIT_COMMITTER_DATE: commit.date,
    })
  }

  return { root, docsDir: path.join(root, 'docs') }
}

export async function createPlainDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'boltdocs-no-git-'))
}

export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true })
}
