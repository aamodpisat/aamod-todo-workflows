# Aamod Personal Todo

Design-review plan for a single-operator task board with Jira-style columns. This phase is the plan and the clickable prototype in `prototype/index.html`. Production code comes after you confirm the screens and the defaults below.

## What you will be able to do

- Open the app on a board of workflows. The starting set is Todo, In Progress, In Review, On Hold, Done, and Archived.
- Create a task. It always starts in Todo. The workflow is changed afterward, from the task or by dragging. Deleting a task is not available anywhere: no button, no API, no archive-as-delete. Archived is a workflow you move a task into.
- Drag a task from one workflow to another, or change its workflow from the task page.
- Open a task for the description, comments, links, tags, people to notify, and an optional deadline.
- Filter the board by tags.
- Add, remove, reorder, and rename workflows from an admin screen that only the signed-in operator can open. A workflow that still holds tasks cannot be removed. The last remaining workflow cannot be removed.
- See a dashboard that leads with the one task to do first, then workflow mix, how long open tasks have sat, and deadline pressure.
- Receive a daily email and a 7-day reminder. Both lead with one task to act on. Subject, headline, opening, and closing are edited from the workflow admin.
- Tag a person by email. They receive the update, follow-up, or reminder. They do not get a login.

## Defaults locked for the first build

Change any of these in the review canvas or in chat before implementation.

| Decision | Default |
| --- | --- |
| Product name | Aamod Personal Todo |
| Operator | One person. Login is a system id compared on the server. |
| Daily email | 08:00 Asia/Kolkata |
| Stuck rule | 7 full days in the current workflow |
| Workflows that alert | Todo, In Progress, In Review, On Hold. Done and Archived do not. |
| Near deadline | Due within 48 hours, or already past the deadline. Both use a red mark. The label says Due soon or Overdue. |
| Done and Archived | No deadline warning once the task is in either workflow. |
| Tagged people | Email only |
| Spelling | Archived, not Archieved |

## Notifications

Email is the reliable channel. A Vercel website cannot post a native iPhone notification by itself. iOS will show the emails in Mail if notifications for Mail are on. After the email jobs work, the app can also ask to send Web Push, which iOS delivers only when the site has been added to the Home Screen (iOS 16.4 or later). A native Apple push app is out of scope.

Secrets stay in Vercel environment variables, never in the repository: `APP_SYSTEM_ID`, `SESSION_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, and later `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. The production system id is given to you in chat when we deploy, not written into source.

The daily mail names one task to do first, then a short list of the rest. The stuck mail names the task, the workflow, and how many days it has waited. Wording is stored with the workflows and edited in admin. Placeholders are `{{name}}`, `{{urgent}}`, `{{open}}`, `{{stuck}}`, `{{task}}`, `{{workflow}}`, and `{{days}}`.

## Stack

- Next.js (App Router) and TypeScript on Vercel
- Postgres (Neon) so data survives serverless invocations
- Drag and drop with `@dnd-kit`
- Resend for mail
- Vercel Cron for the daily digest and the stuck check
- Signed httpOnly session cookie. The system id is compared in constant time. Failed attempts are rate-limited.

## Data

- Workflow: name, order, whether the 7-day alert is on
- Task: title, description, workflow, time it entered that workflow, optional deadline, created time
- Comment, tag, link (http or https, label plus URL), notify email
- Mail log so a stuck task is not emailed every hour; one stuck notice per visit to a workflow, then again only after it moves and sits another 7 days

Moving a task sets a new entered-workflow time. That resets the 7-day clock.

## Build order, after you approve the prototype

1. App shell, login, database, board, create task, move workflow. No delete path.
2. Task page: comments, links, tags, notify emails, optional deadline, red deadline mark.
3. Drag and drop, tag filter, admin workflow editor.
4. Dashboard.
5. Daily email and 7-day email via Vercel Cron.
6. Optional Home Screen web push.
7. Deploy to Vercel and set the system id only in the project environment.

## Prototype

Open `prototype/index.html` in a browser. It is local sample data in this browser only. The preview login accepts any code of 8 or more characters. That code is not the production system id.
