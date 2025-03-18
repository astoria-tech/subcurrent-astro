# Discord Notifications for Subcurrent RSS

This feature allows you to send notifications to a Discord channel whenever new items appear in your Subcurrent RSS feed.

## How It Works

The system works as follows:

1. New RSS feeds are fetched on a schedule (every 6 hours) via GitHub Actions
2. After the site is rebuilt and deployed, the Discord notifier runs
3. The notifier checks for new items that haven't been posted to Discord before
4. New items are sent as rich embeds to your Discord channel via webhook
5. A record of sent items is maintained to prevent duplicates

## Setup Instructions

### 1. Create a Discord Webhook

1. In your Discord server, go to a channel's settings
2. Select "Integrations" → "Webhooks" → "New Webhook"
3. Give it a name (e.g., "Subcurrent RSS")
4. Copy the webhook URL

### 2. Add the Webhook URL to GitHub Secrets

1. Go to your GitHub repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Name: `DISCORD_WEBHOOK_URL`
5. Value: Paste the webhook URL you copied
6. Click "Add secret"

### 3. Customization (Optional)

You can customize the behavior by editing `src/utils/discordNotifier.ts`:

- `MAX_NOTIFICATIONS`: Change the maximum number of notifications sent per run (default: 5)
- Modify the Discord embed format in the `sendToDiscord` function
- Adjust the delay between notifications (default: 1 second)

## Manual Triggering

You can manually trigger notifications by:

1. Running the GitHub Action workflow manually (via the "Actions" tab)
2. Or locally with: `npm run notify-discord`

## Troubleshooting

- Check GitHub Actions logs for any errors
- Ensure the Discord webhook URL is correctly set in the repository secrets
- Verify that your Discord webhook has proper permissions in the channel

## Technical Details

- The notifier stores a record of sent items in `.discord-sent-posts.json`
- Items are identified by their link URL to avoid duplicates
- We use a 60-second delay after deployment to ensure the RSS feed is available
